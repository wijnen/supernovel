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

def list(wake, groupid): # {{{
	'''Get a list of available scripts.'''

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

def list_questions(wake, scriptid): # {{{
	'Get information about all questions in a script.'
	data = (yield from serverdata[0].select('question', ('id', 'type', 'description'), ('=', 'script', scriptid), wake = wake))
	return [{'id': d[0], 'type': d[1], 'description': d[2]} for d in data] 
# }}}

def list_players(wake, scriptid): # {{{
	'Get answers to all questions by managed users.'
	players = (yield from serverdata[0].list_managed_players(None, wake = wake))
	return players
# }}}

errors = []
def parse_error(line, message): # {{{
	errors.append('{}: {}'.format(line if line is not None else '(from code)', message))
	debug(1, '{}: parse error: {}'.format(line, message))
# }}}

def read_structure(f): # {{{
	'''Parse script text into structured format.
	Input: iterable (text file or sequence of strings).
	Returns: dict of
	{
		'line': int,
		'code': str,
		'children': dicts of indented lines (same format),
		'rawchildren': str of indented block, for when it is not code.
	}
	'''
	indentstack = ['']
	stack = [[]]
	ln = 0
	for line in f:
		ln += 1
		l = line.lstrip()
		if l == '' or l.startswith('--'):
			continue
		i = line[:len(line) - len(l)]
		if len(i) > len(indentstack[-1]):
			# Indentation has increased.
			if len(stack[-1]) == 0:
				parse_error(ln, 'first line of file must not be indented')
				continue
			if not i.startswith(indentstack[-1]):
				parse_error(ln, 'indentation changed during increase')
			stack.append(stack[-1][-1]['children'])
			indentstack.append(i)
		while len(i) < len(indentstack[-1]):
			# Indentation has decreased.
			stack.pop()
			indentstack.pop()
		if indentstack[-1] != i:
			parse_error(ln, 'indentation changed')
		stack[-1].append({'line': ln, 'code': line.strip(), 'children': [], 'rawchildren': ''})
		# Add line to all raw children. Use indent of next level (which is the child's level).
		for frames, indent in zip(stack[:-1], indentstack[1:]):
			frames[-1]['rawchildren'] += line[len(indent):] + '\n'
	return stack[0]
# }}}

def parse_raw(ln, d, firstline): # {{{
	if firstline != '':
		if d['rawchildren'] != '':
			print(repr(d), repr(firstline))
			parse_error(ln, 'raw block present after inline data')
		return firstline
	return d['rawchildren']
# }}}

def parse_anim_args(ln, cmd, a, parent_args): # {{{
	args = {'with': None, 'in': None, 'to': None, 'from': None, 'scale': None, 'rotation': None, 'around': None}
	if a is None:
		return args
	while len(a) > 0:
		ra = re.match(r'.*\b((with|in|to|from|scale|rotation|around)\s+(.+?))$', a)
		if ra is None:
			print('error string:', repr(a))
			parse_error(ln, 'syntax error parsing animation arguments')
			return None
		full = ra.group(1)
		key = ra.group(2)
		expr = ra.group(3)
		a = a[:-len(full)].strip()
		if args[key] is not None:
			parse_error(ln, 'duplicate attribute')
			continue
		args[key] = expr
	if parent_args is not None:
		for a in args:
			if args[a] is None:
				args[a] = parent_args[a]
	return args
# }}}

def parse_anim_element(ln, c, d, parent_args): # {{{
	'''Read and return single animation command, possibly including children
	Returns None if this was not an animation command, False if there was an error and the action otherwise.'''
	# parallel, serial {{{
	# Code: parallel <anim parameters>
	# Code: serial <anim parameters>
	r = re.match(r'(parallel|serial)\b\s*(.*)\s*$', c)
	if r is not None:
		args = parse_anim_args(ln, r.group(1), r.group(2), parent_args)
		if args is None:
			# Parsing arguments triggered an error. Abort.
			return False
		ret = {'action': r.group(1), 'target': None, 'line': ln, 'args': args, 'actions': []}
		for ch in d['children']:
			action = parse_anim_element(ch['line'], ch['code'], ch, args)
			if action is None:
				parse_error(ch['line'], 'only animation commands are allowed in this context')
				continue
			if action is False:
				continue
			ret['actions'].append(action)
		return ret
	# }}}

	# speech {{{
	# Code: <speakertag> [<mood>]: <text|indented>
	r = re.match(r'(\w+)(?:,(\w+))?:\s*(.*?)\s*$', c)
	if r is not None:
		return {'action': 'speech', 'line': ln, 'speaker': r.group(1), 'mood': r.group(2), 'markdown': parse_raw(ln, d, r.group(3))}
	# }}}
	
	# wait {{{
	# Code: wait <time>
	r = re.match(r'wait\s+(\S.*?)\s*$', c)
	if r is not None:
		if len(d['children']) > 0:
			parse_error(ln, 'wait cannot have indented block argument')
			return False
		return {'action': 'wait', 'line': ln, 'time': r.group(1)}
	# }}}

	# font {{{
	# Code: font <css-code>
	r = re.match(r'font(?:\s*(\S.*?))?\s*$', c)
	if r is not None:
		return {'action': 'font', 'line': ln, 'css': r.group(1)}
	# }}}

	# scene, hide, move, sound, music {{{
	# Code: scene <target> [<anim-attributes>]
	# Code: hide <target>[,<mood>] [<anim-attributes>]
	# Code: move <target>[,<mood>] [<anim-attributes>]
	# Code: sound <target>
	# Code: music <target>
	r = re.match(r'(scene|hide|move|sound|music)\s*(?:\s(\S+?(?:\s*,\s*\S+)?)\s*(?:\s+(\S.*?)\s*)?)?$', c)
	# group 1: command
	# group 2: target[,mood]
	# group 3: anim attributes
	if r is None:
		return None

	if len(d['children']) > 0:
		parse_error(ln, 'command cannot have indented block argument')
		return False

	if r.group(1) in ('sound', 'music'):
		if r.group(3):
			parse_error(ln, 'command does not support animation arguments')
			return False
		return {'action': r.group(1), 'target': r.group(2)}

	if r.group(1) != 'scene' and r.group(2) is None:
		parse_error(ln, 'command needs a target')
		return False

	args = parse_anim_args(ln, r.group(1), r.group(3), parent_args)
	if args is None:
		# There was an error.
		return False

	t = r.group(2)
	if ',' in t:
		target, mood = map(str.strip, t.split(',', 1))
	else:
		target = t
		mood = None

	return {'action': r.group(1), 'target': target, 'mood': mood, 'args': args, 'line': ln}
	# }}}
# }}}

def parse_anim(ln, c, d, ostack): # {{{
	'''Check if a line is an animation command. Parse it and return True if it is.'''
	action = parse_anim_element(ln, c, d, None)
	if action is None:
		# This was not an animation command.
		return False
	if action is False:
		# There was an error, which has already been reported.
		return True
	if len(ostack[-1]) == 0 or ostack[-1][-1]['command'] != 'kinetic':
		ostack[-1].append({'command': 'kinetic', 'line': ln, 'kinetic': []})
	ostack[-1][-1]['kinetic'].append(action)
	return True
# }}}

def parse_line(d, ln, istack, ostack, index, question): # {{{
	# d is the data dict of the current line; ln is the current line number.
	# return False if parsing should be aborted, True otherwise.
	# Note that True does not imply parsing was successfull. False is only returned if the error will likely cause a chain of useless errors.
	c = d['code']

	#print('parsing line: %s' % repr(c))

	# end is ignored so lua syntax is allowed (but not enforced). {{{
	# Code: end
	if c == 'end':
		return True
	# }}}

	# Commands with child blocks {{{
	# comment {{{
	r = re.match(r'comment\b.*$', c)
	if r is not None:
		return True
	# }}}

	# if, elseif, while {{{
	# Code: if expression then <code|indented> [end]
	# Code: elif expression then <code|indented> [end]
	# Code: while expression do <code|indented> [end]
	r = re.match(r'(if|elseif|while)\b\s*(.*?)\s*\b(then|do)\b\s*(.*?)\s*$', c)
	if r is not None:
		cmd = r.group(1)
		expr = r.group(2)
		thendo = r.group(3)
		code = r.group(4)
		if (cmd == 'while') ^ (thendo == 'do'):
			parse_error(ln, 'command %s does not match with tag %s' % (cmd, thendo))
			return False
		new_frame = []
		if cmd == 'if':
			ostack[-1].append({'command': 'if', 'line': ln, 'code': [(expr, new_frame)]})
		elif cmd == 'elseif':
			if ostack[-1][-1]['command'] != 'if':
				parse_error(ln, 'elif without if')
				return False
			ostack[-1][-1]['code'].append((expr, new_frame))
		elif cmd == 'while':
			ostack[-1].append({'command': 'while', 'line': ln, 'test': expr, 'code': new_frame, 'else': []})
		ostack.append(new_frame)
		if len(code) == 0:
			istack.append(d['children'])
		else:
			# Allow (but don't require) "end" at end of line.
			if code.endswith('end'):
				code = code[:-3].strip()
			istack.append([{'code': code, 'line': ln, 'children': []}])
			if len(d['children']) > 0:
				parse_error(ln, 'indented block is only allowed without inline code')
		return True
	# }}}

	# else {{{
	# Code: else <code|indented> [end]
	r = re.match(r'else\b\s*(.*?)\s*$', c)
	if r is not None:
		code = r.group(1)
		has_code = len(code) > 0
		if code.endswith('end'):
			code = code[:-3].strip()
		if ostack[-1][-1]['command'] == 'if':
			new_frame = []
			ostack[-1][-1]['code'].append((None, new_frame))
			ostack.append(new_frame)
			if not has_code:
				istack.append(d['children'])
			else:
				istack.append([{'code': code, 'line': ln, 'children': []}])
				if len(d['children']) > 0:
					parse_error(ln, 'indented block is only allowed without inline code')
		elif ostack[-1][-1]['command'] == 'while':
			new_frame = ostack[-1][-1]['else']
			if not has_code:
				ostack.append(new_frame)
			else:
				istack.append([{'code': code, 'line': ln, 'children': []}])
				if len(d['children']) > 0:
					parse_error(ln, 'indented block is only allowed without inline code')
			istack.append(d['children'])
		else:
			parse_error(ln, 'else without if or while')
			return False
		return True
	# }}}

	# question {{{
	# Code: question hidden <qname> <text|indented>
	# Code: question short <qname> <text|indented>
	# Code: question long <qname> <text|indented>
	# Code: question unit <qname> <text|indented>
	# Code: question choice <qname> <text|indented>
	# Code: question longshort <qname> <text|indented>
	# Code: question longunit <qname> <text|indented>
	# Code: question longchoice <qname> <text|indented>
	r = re.match(r'question\s+(\S+)\s+(\S+)\b\s*(.*)$', c)
	if r is not None:
		t = r.group(1)
		if t not in ('hidden', 'short', 'long', 'unit', 'choice', 'longshort', 'longunit', 'longchoice'):
			parse_error(ln, 'invalid question type')
			return True
		name = r.group(2)
		text = parse_raw(ln, d, r.group(3))
		ostack[-1].append({'command': 'question', 'type': t, 'variable': name, 'markdown': text, 'line': ln})
		if 'choice' in t:
			ostack[-1][-1]['option'] = []
		else:
			ostack[-1][-1]['option'] = None
		question.append({'id': name, 'type': t, 'description': text})
		return True
	# }}}

	# option {{{
	# Code: option <text|indented>
	r = re.match(r'option\s+(.*?)\s*$', c)
	if r is not None:
		if ostack[-1][-1]['command'] != 'question' or 'choice' not in ostack[-1][-1]['type']:
			parse_error(ln, 'option is only allowed after a multiple choice question')
			return True
		ostack[-1][-1]['option'].append(parse_raw(ln, d, r.group(1)))
		return True
	# }}}

	# code {{{
	# Code code <lua|indented>
	r = re.match(r'code\b\s*(.*?)\s*$', c)
	if r is not None:
		if len(r.group(1)) > 0:
			if len(d['children']) > 0:
				parse_error(ln, 'code command cannot have both inline and block code')
				return True
			ostack[-1].append({'command': 'code', 'line': ln, 'code': r.group(1)})
			return True
		ostack[-1].append({'command': 'code', 'line': ln, 'code': parse_raw(ln, d, r.group(1))})
		return True
	# }}}

	if parse_anim(ln, c, d, ostack):
		return True
	# }}}

	if len(d['children']) > 0:
		parse_error(ln, 'unexpected indent')
		return False

	# Commands which should not have an indented block after them {{{
	# $ {{{
	# Code: $ <lua>
	if c[0] == '$':
		ostack[-1].append({'command': 'code', 'line': ln, 'code': c[1:].strip()})
		return True
	# }}}

	# break, continue {{{
	# Code: break
	# Code: continue
	if c in ('break', 'continue'):
		ostack[-1].append({'command': c, 'line': ln})
		return True
	# }}}

	# label, goto {{{
	# Code: label <name>
	# Code: goto <name>
	r = re.match(r'(label|goto)\s*(\S*)\s*$', c)
	if r is not None:
		if r.group(1) == 'label' and len(ostack) > 1:
			parse_error(ln, 'labels are only allowed at top level')
			return True
		name = r.group(2)
		if name.startswith('.'):
			name = last_label + name
		else:
			last_label = name
		index[r.group(1)][name] = len(ostack[0])
		ostack[0].append({'command': r.group(1), 'line': ln, 'label': name, 'target': None})
		return True
	# }}}

	# video {{{
	# Code: video <name>
	r = re.match(r'video\s+(.*)\s*$', c)
	if r is not None:
		ostack[-1].append({'command': 'video', 'line': ln, 'video': r.group(1)})
		return True
	# }}}

	# answer {{{
	# Code: answer <style>
	r = re.match(r'answer\s*(.*)\s*$', c)
	if r is not None:
		ostack[-1].append({'command': 'answer', 'line': ln, 'answer': r.group(1)})
		return True
	# }}}

	# sprite {{{
	# Code: sprite <tag> <image-collection> <display-name>
	r = re.match(r'sprite\s+(\S+)(?:\s+(\S+)(?:\s+(.+?))?)?\s*$', c)
	if r is not None:
		tag = r.group(1)
		images = r.group(2) or ''
		name = r.group(3) or ''
		ostack[-1].append({'command': 'sprite', 'line': ln, 'images': images, 'name': name, 'tag': tag})
		return True
	# }}}
	# }}}

	parse_error(ln, 'syntax error')
	return True
# }}}

def parse_script(script): # {{{
	'''Parse a script into structured code.
	Returns tuple: parsed script, list of parse errors.'''
	global errors
	errors = []
	data = read_structure(script.split('\n'))
	istack = [data]
	ret = []
	ostack = [ret]
	index = {'label': {}, 'goto': {}}
	question = []
	while len(istack) > 0:
		if len(istack[-1]) > 0:
			d = istack[-1].pop(0)
			ln = d['line']
			parse_line(d, ln, istack, ostack, index, question)
		while len(istack) > 0 and len(istack[-1]) == 0:
			istack.pop()
			ostack.pop()
	for label in index['goto']:
		source = ret[index['goto'][label]]
		if label not in index['label']:
			parse_error(source['line'], 'undefined label')
		else:
			source['target'] = index['label'][label]
	#print('parsed script:', repr(ret))
	return ret, errors, question, index['label']
# }}}

def parse_script_list(wake, script_list): # {{{
	'''Parse script list (except last element). Return chapter id.'''
	current = None
	for part in script_list[:-1]:
		result = (yield from serverdata[0].select('chapter', ('id',), ('and', ('=', 'name', part), ('=', 'parent', current)), wake = wake))
		assert len(result) == 1
		current = result[0][0]
	return current
# }}}

def get_scriptid(wake, script_list): # {{{
	'''Get script id from path. This is called by the admin interface, it does not check for permissions.'''
	chapter = (yield from parse_script_list(wake, script_list))
	result = (yield from serverdata[0].select('script', ('id',), ('and', ('=', 'chapter', chapter), ('=', 'name', script_list[-1])), wake = wake))
	assert len(result) == 1
	return result[0][0]
# }}}

def get(wake, groupid, script_list): # {{{
	'''Get the script from a list of chapter names; accessible by groupid.
	Returns chapterid, scriptid, code'''
	chapter = (yield from parse_script_list(wake, script_list))
	# Check that the group has access to this chapter.
	check = (yield from serverdata[0].select('access', ('groupid',), ('and', ('=', 'groupid', groupid), ('=', 'chapter', chapter)), wake = wake))
	assert len(check) == 1

	result = (yield from serverdata[0].select('script', ('id', 'script'), ('and', ('=', 'chapter', chapter), ('=', 'name', script_list[-1])), wake = wake))
	assert len(result) == 1
	scriptid, script = result[0]
	return chapter, scriptid, parse_script(script)
# }}}

# vim: set foldmethod=marker :
