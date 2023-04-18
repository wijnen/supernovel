#!/usr/bin/python3

# Imports {{{
import sys
import os
import re
from debug import debug
# }}}

serverdata = [None]
def init(data):
	serverdata[0] = data

# Get information from the database. {{{
def list(wake, groupid):
	'''Get a list of available scripts.'''
	# {{{

	# Load all chapters that can be accessed.
	if groupid is None:
		access = (yield from serverdata[0].select('access', ('chapter',), wake = wake))
	else:
		access = (yield from serverdata[0].select('access', ('chapter',), ('=', 'groupid', groupid), wake = wake))
	cache = {}	# keys: IDs, values: {'name': ..., 'parent': ...}
	for chapter in access:
		c = chapter[0]
		data = (yield from serverdata[0].select('chapter', ('name', 'parent'), ('=', 'id', c), wake = wake))
		assert len(data) == 1
		name, parent = data[0]
		cache[c] = {'name': name, 'parent': parent}

	# Load missing parents.
	todo = []
	for chapter in access:
		c = chapter[0]
		parent = cache[c]['parent']
		if parent is not None and parent not in cache and parent not in todo:
			todo.append(parent)
	while len(todo) > 0:
		t = todo.pop()
		data = (yield from serverdata[0].select('chapter', ('name', 'parent'), ('=', 'id', t), wake = wake))
		assert len(data) == 1
		name, parent = data[0]
		cache[c] = {'name': name, 'parent': parent}
		if parent is not None and parent not in cache and parent not in todo:
			todo.append(parent)

	# Find all scripts.
	ret = []
	for chapter in access:
		c = chapter[0]
		path = [cache[c]['name']]
		p = c
		while cache[p]['parent'] is not None:
			p = cache[p]['parent']
			path.insert(0, cache[p]['name'])
		data = (yield from serverdata[0].select('script', ('name',), ('=', 'chapter', c), wake = wake))
		for s in data:
			ret.append(path + [s[0]])

	return ret
# }}}

def list_questions(wake, scriptid):
	'Get information about all questions in a script.'
	# {{{
	data = (yield from serverdata[0].select('question', ('id', 'type', 'description'), ('=', 'script', scriptid), wake = wake))
	return [{'id': d[0], 'type': d[1], 'description': d[2]} for d in data] 
# }}}

def list_players(wake, scriptid):
	'Get answers to all questions by managed users.'
	# {{{
	players = (yield from serverdata[0].list_managed_players(None, wake = wake))
	return players
# }}}

def parse_script_list(wake, script_list):
	'''Parse script list (except last element). Return chapter id.'''
	# {{{
	current = None
	for part in script_list[:-1]:
		result = (yield from serverdata[0].select('chapter', ('id',), ('and', ('=', 'name', part), ('=', 'parent', current)), wake = wake))
		assert len(result) == 1
		current = result[0][0]
	return current
# }}}

def get_scriptid(wake, script_list):
	'''Get script id from path. This is called by the admin interface, it does not check for permissions.'''
	# {{{
	chapter = (yield from parse_script_list(wake, script_list))
	result = (yield from serverdata[0].select('script', ('id',), ('and', ('=', 'chapter', chapter), ('=', 'name', script_list[-1])), wake = wake))
	assert len(result) == 1
	return result[0][0]
# }}}

def get(wake, groupid, script_list):
	'''Get the script from a list of chapter names; accessible by groupid.
	Returns chapterid, scriptid, code'''
	# {{{
	chapter = (yield from parse_script_list(wake, script_list))
	# Check that the group has access to this chapter.
	check = (yield from serverdata[0].select('access', ('groupid',), ('and', ('=', 'groupid', groupid), ('=', 'chapter', chapter)), wake = wake))
	assert len(check) == 1

	result = (yield from serverdata[0].select('script', ('id', 'script'), ('and', ('=', 'chapter', chapter), ('=', 'name', script_list[-1])), wake = wake))
	assert len(result) == 1
	scriptid, script = result[0]
	return chapter, scriptid, parse_script(script)
# }}}
# }}}

# Parse scripts. {{{
errors = []
def parse_error(line, message):
	'Append a parse error to the pending errors and log it to the screen'
	# {{{
	errors.append('{}: {}'.format(line if line is not None else '(from code)', message))
	debug(1, '{}: parse error: {}'.format(line, message))
# }}}

def parse_anim_args(lines, ln, line):
	# {{{
	ret = {'with': None, 'in': None, 'to': None, 'from': None, 'scale': None, 'rotation': None, 'around': None}
	while True:
		ln, line = parse_whitespace(lines, ln, line)
		r = re.match(r'(with|in|to|from|scale|rotation|around)\b', line)
		if r is None:
			return ln, line, ret
		src_ln = ln
		ln, line, arg = parse_word(lines, ln, line[r.end():])
		#print('anim args found %s value %s current args %s remaining line %s' % (r.group(1), arg, ret, line))
		if ret[r.group(1)] is not None:
			parse_error(src_ln, 'duplicate animation argument %s' % r.group(1))
		else:
			ret[r.group(1)] = arg
# }}}

def parse_whitespace(lines, ln, line):
	'''Read away whitespace and comments, return ln, line.'''
	# {{{
	ret = ''
	start_ln = ln
	line = line.lstrip()	# Just to be sure.
	# Drop empty lines and comments.
	while True:
		r = re.match(r'--\[(=*)\[', line.strip())
		if r is not None:
			terminator = '\]' + r.group(1) + '\]'
			ln, line, comment = parse_long_string(terminator, lines, ln, line)
			continue
		if line != '' and not line.startswith('--'):
			return ln, line
		if ln >= len(lines):
			# End of file.
			return ln, ''
		line = lines[ln].lstrip()
		ln += 1
# }}}

def parse_long_string(terminator, lines, ln, line):
	'''Read a long string or other multi-line text from lines, return ln, line, result.'''
	# {{{
	ret = ''
	start_ln = ln
	if line.startswith('\n'):
		line = line[1:]
	while True:
		r = re.search(terminator, line)
		if r is not None:
			return ln, line[r.end():].lstrip(), ret + line[:r.start()]
		ret += line
		if ln >= len(lines):
			parse_error(start_ln, 'unexpected end of file looking for %s' % terminator)
			return ln, '', ret
		line = lines[ln]
		ln += 1
# }}}

def parse_text(lines, ln, line):
	'''Read a text until end of line, or a long string from lines, return ln, line, result.'''
	# {{{
	ln, line = parse_whitespace(lines, ln, line)
	r = re.match(r'\[(=*)\[', line)
	if r is None:
		# Use text until end of line.
		text = line
		line = ''
	else:
		terminator = '\]' + r.group(1) + '\]'
		ln, line, text = parse_long_string(terminator, lines, ln, line[r.end():])
	return ln, line, text
# }}}


def parse_word(lines, ln, line):
	'''Read a single word, or quoted text on a line, or a long string.'''
	# {{{
	src_ln = ln
	# Drop empty lines and comments.
	ln, line = parse_whitespace(lines, ln, line)
	if line == '':
		parse_error(src_ln, 'unexpected end of file')
		return ln, line, ''
	r = re.match(r'\[(=*)\[', line)
	if r is None:
		# Use next word.
		if line[0] in '"\'':
			e = line.find(line[0], 1)
			if e < 0:
				parse_error(ln, 'unterminated quoted string')
				return ln, '', line
			return ln, line[e + 1:], line[1:e]
		fragments = line.split(None, 1)
		return ln, fragments[1] if len(fragments) > 1 else '', fragments[0]
	else:
		terminator = '\]' + r.group(1) + '\]'
		ln, line, text = parse_long_string(terminator, lines, ln, line[r.end():])
	return ln, line, text
# }}}

def parse_script(script):
	'''Parse a script into structured code.
	Returns tuple: parsed script, list of parse errors, list of questions.'''
	# {{{
	global errors
	errors = []
	question = []
	ret = []	# Final return value. Also initial value on output stack. Contains dicts of 1 instruction each.
	ostack = [ret]	# Output stack.	Contains instruction lists (entire script, then-blocks, while-blocks) and kinetic action lists.
	ln = 0
	lines = script.split('\n')
	while ln < len(lines):
		line = lines[ln].lstrip()
		ln += 1
		while len(line) > 0:
			#print('current line:', line)
			ln, line = parse_whitespace(lines, ln, line)
			src_ln = ln
			# Code. {{{
			r = re.match(r'\$\[(=*)\[', line)
			if r is not None:
				level = len(r.group(1))
				line = line[r.end():]
				terminator = r'\]' + '=' * level + r'\]'
				ln, line, result = parse_long_string(terminator, lines, ln, line)
				ostack[-1].append({'command': 'code', 'line': src_ln, 'code': result})
				continue
			if line.startswith('$'):
				# Single line code.
				ostack[-1].append({'command': 'code', 'line': ln, 'code': line[1:].strip()})
				break
			# }}}
			# Flow control. {{{
			r = re.match(r'(if|elseif|else|while|end|break|continue)\b', line)
			if r is not None:
				cmd = r.group(1)
				if cmd == 'if': # {{{
					ln, line, expr = parse_long_string(r'\bthen\b', lines, ln, line[r.end():])
					new_frame = []
					ostack[-1].append({'command': 'if', 'line': src_ln, 'code': [(expr, new_frame)]})
					ostack.append(new_frame)
					continue
				# }}}
				elif cmd == 'elseif': # {{{
					if len(ostack) < 2 or ostack[-2][-1]['command'] != 'if':
						parse_error(ln, 'elseif without if')
						break
					ln, line, expr = parse_long_string(r'\bthen\b', lines, ln, line[r.end():])
					new_frame = []
					ostack.pop()
					ostack[-1][-1]['code'].append((expr, new_frame))
					ostack.append(new_frame)
					continue
				# }}}
				elif cmd == 'else': # {{{
					if len(ostack) < 2 or ostack[-2][-1]['command'] not in ('if', 'while'):
						parse_error(ln, 'else without if or while')
						break
					if ostack[-2][-1]['command'] == 'if':
						new_frame = []
						ostack.pop()
						ostack[-1][-1]['code'].append((None, new_frame))
						ostack.append(new_frame)
						line = line[r.end():]
						continue
					else:
						ostack.pop()
						ostack.append(ostack[-1][-1]['else'])
						line = line[r.end():]
						continue
				# }}}
				elif cmd == 'while': # {{{
					ln, line, expr = parse_long_string(r'\bdo\b', lines, ln, line[r.end():])
					new_frame = []
					ostack[-1].append({'command': 'while', 'line': src_ln, 'test': expr, 'code': new_frame, 'else': []})
					ostack.append(new_frame)
					continue
				# }}}
				elif cmd == 'end': # {{{
					if len(ostack) < 2:
						parse_error(ln, 'end at top level')
						break
					ostack.pop()
					line = line[len(cmd):].lstrip()
					continue
				# }}}
				else:
					assert cmd in ('break', 'continue') # {{{
					ostack[-1].append({'command': cmd, 'line': ln})
					line = line[len(r.group(0)):].lstrip()
					continue
				# }}}
			# }}}
			# Questions. {{{
			r = re.match(r'(answer|question|option)\b', line)
			if r is not None:
				cmd = r.group(1)
				if cmd == 'question':
					ln, line, t = parse_word(lines, ln, line[r.end():])
					if t not in ('hidden', 'short', 'long', 'unit', 'choice', 'longshort', 'longunit', 'longchoice'):
						parse_error(src_ln, 'invalid question type %s' % t)
						break
					ln, line, tag = parse_word(lines, ln, line)
					ln, line, text = parse_text(lines, ln, line)
					ostack[-1].append({'command': 'question', 'type': t, 'variable': tag, 'markdown': text, 'line': src_ln})
					question.append({'id': tag, 'type': t, 'description': text})
					continue

				else:
					assert cmd in ('answer', 'option')
					ln, line, text = parse_text(lines, ln, line)
					ostack[-1].append({'command': cmd, 'line': ln, cmd: text})
					continue
			# }}}
			# Animation. {{{
			r = re.match(r'(parallel|serial|wait|scene|hide|move|sound|music|video|style|launch|loop|stop|random)\b', line)
			if r is not None:
				cmd = r.group(1)
				if cmd in ('parallel', 'serial'): # {{{
					ln, line, args = parse_anim_args(lines, ln, line[r.end():])
					ostack[-1].append({'command': cmd, 'line': src_ln, 'args': args, 'actions': []})
					ostack.append(ostack[-1][-1]['actions'])
				# }}}
				elif cmd == 'wait': # {{{
					ln, line, t = parse_word(lines, ln, line[r.end():])
					ostack[-1].append({'command': cmd, 'line': src_ln, 'time': t})
				# }}}
				elif cmd in ('scene', 'hide', 'move'): # {{{
					ln, line, target = parse_word(lines, ln, line[r.end():])
					if ',' in target:
						target, mood = target.split(',', 1)
					else:
						mood = None
					ln, line, args = parse_anim_args(lines, ln, line)
					ostack[-1].append({'command': cmd, 'line': src_ln, ('image' if cmd == 'scene' else 'target'): target, 'mood': mood, 'args': args})
				# }}}
				elif cmd in ('sound', 'music', 'video'): # {{{
					ln, line, target = parse_word(lines, ln, line[r.end():])
					ostack[-1].append({'command': cmd, 'line': src_ln, 'target': target})
				# }}}
				else:
					assert cmd in ('style', 'launch', 'loop', 'stop', 'random') # {{{
					raise NotImplementedError('not implemented yet')
					# TODO
				# }}}
				continue
			r = re.match(r'(\S+)\s*(?:,\s*(\S*)\s*)?:(?:\[(=*)\[)?\s*', line)
			if r is not None:
				# Group 1: speaker name.
				# Group 2: mood or None.
				# Group 3: long string filler ('=' signs only; None if no long string tag).
				if r.group(3) is None:
					text = line
					line = ''
				else:
					terminator = r'\]' + r.group(3) + r'\]'
					ln, line, text = parse_long_string(terminator, lines, ln, line[r.end():])
				ostack[-1].append({'command': 'speech', 'line': src_ln, 'speaker': r.group(1), 'mood': r.group(2), 'markdown': text})
				continue
			# }}}

			if line != '':
				parse_error(src_ln, 'syntax error: %s' % line)
				line = ''
	#print('parsed script:', repr(ret))
	return ret, errors, question
# }}}
# }}}
# vim: set foldmethod=marker :
