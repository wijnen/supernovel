#!/usr/bin/python3

# Imports {{{
import sys
import os
import re
from __main__ import config
from debug import debug
# }}}

def list(group): # {{{
	'''Get a list of available sections.'''
	content_dir = os.path.join(config['data'], 'users', group.lower(), 'Content')
	if not os.path.exists(content_dir):
		return {}
	ret = {}
	for chapter in os.listdir(content_dir):
		cpath = os.path.join(content_dir, chapter)
		if not os.path.isdir(cpath):
			continue
		section = []
		for s in os.listdir(cpath):
			if not s.endswith('.script'):
				continue
			spath = os.path.join(cpath, s)
			if os.path.isdir(spath):
				continue
			section.append(os.path.splitext(s)[0])
		if len(section) == 0:
			continue
		section.sort()
		ret[chapter] = section
	return ret
# }}}

errors = []
def parse_error(line, message):
	errors.append('{}: {}'.format(line if line is not None else '(from code)', message))
	debug(1, '{}: parse error: {}'.format(line, message))

def read_structure(f): # {{{
	indentstack = ['']
	stack = [[]]
	ln = 0
	for line in f:
		ln += 1
		l = line.lstrip()
		if l == '' or l.startswith('#'):
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
			frames[-1]['rawchildren'] += line[len(indent):]
	return stack[0]
# }}}

def parse_raw(ln, d, firstline):
	if firstline != '':
		if d['rawchildren'] != '':
			parse_error(ln, 'raw block present after inline data')
		return firstline
	return d['rawchildren']

def parse_anim_args(ln, a, parent_args):
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

def parse_anim_element(ln, c, d, parent_args):
	'''Read and return single animation command, possibly including children
	Returns None if this was not an animation command, False if there was an error and the action otherwise.'''
	# parallel, serial
	r = re.match(r'(parallel|serial)\b\s*(.*)\s*:$', c)
	if r is not None:
		args = parse_anim_args(ln, r.group(2), parent_args)
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

	# speech
	r = re.match(r'(\S*)(?:\s+(\S*))?\s*:\s*(.*?)\s*$', c)
	if r is not None:
		return {'action': 'speech', 'line': ln, 'speaker': r.group(1), 'image': r.group(2), 'markdown': parse_raw(ln, d, r.group(3))}
	
	# wait
	r = re.match(r'wait\s+(\S.*?)\s*$', c)
	if r is not None:
		return {'action': 'wait', 'line': ln, 'time': r.group(1)}

	# scene, show, hide, move, sound, music
	r = re.match(r'(scene|show|hide|move|sound|music)\s*(?:\s(\S+(?:\s*,\s*\S+)?)\s*(?:\s(\S.*?)\s*)?)?$', c)
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

	args = parse_anim_args(ln, r.group(3), parent_args)
	if args is None:
		# There was an error.
		return False

	t = r.group(2)
	if t != 'scene':
		if ',' in t:
			target, mood = map(str.strip, t.split(',', 1))
		else:
			target = t
			mood = None
	else:
		target = t
		mood = None

	return {'action': r.group(1), 'target': target, 'mood': mood, 'args': args, 'line': ln}

def parse_anim(ln, c, d, ostack):
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

def parse_line(d, ln, istack, ostack, index):
	# d is the data dict of the current line; ln is the current line number.
	# return False if parsing should be aborted, True otherwise.
	# Note that True does not imply parsing was successfull. False is only returned if the error will likely cause a chain of useless errors.
	c = d['code']

	# end is ignored for allowing lua syntax.
	if c == 'end':
		return True

	# if, elseif, while
	r = re.match(r'(if|elseif|while)\b\s*(.*?)\s*\w(then|do)\w\s*(.*?)\s*$', c)
	if r is not None:
		cmd = r.group(1)
		expr = r.group(2)
		thendo = r.group(3)
		code = r.group(4)
		if cmd == 'while' ^ thendo == 'do':
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
			istack.append([{'code': code, 'line': ln, 'children': []}])
			if len(d['children']) > 0:
				parse_error(ln, 'indented block is only allowed without inline code')
		return True

	# else
	r = re.match(r'else\s*(.*?)\s*$', c)
	if r is not None:
		code = r.group(1)
		if ostack[-1][-1]['command'] == 'if':
			new_frame = []
			ostack[-1][-1]['code'].append((None, new_frame))
			ostack.append(new_frame)
			if len(code) == 0:
				istack.append(d['children'])
			else:
				istack.append([{'code': code, 'line': ln, 'children': []}])
				if len(d['children']) > 0:
					parse_error(ln, 'indented block is only allowed without inline code')
		elif ostack[-1][-1]['command'] == 'while':
			new_frame = ostack[-1][-1]['else']
			if len(code) == 0:
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

	# question
	r = re.match(r'question\s+(\S*)\s+(\S*)\s*:\s*(.*)$', c)
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
		return True

	# option
	r = re.match(r'option\s*:\s*(.*?)\s*$', c)
	if r is not None:
		if ostack[-1][-1]['command'] != 'question' or 'choice' not in ostack[-1][-1]['type']:
			parse_error(ln, 'option is only allowed after a multiple choice question')
			return True
		ostack[-1][-1]['option'].append(parse_raw(ln, d, r.group(1)))
		return True

	# code
	r = re.match(r'code\s*:\s*(.*?)\s*$', c)
	if r is not None:
		if len(r.group(1)) > 0:
			if len(d['children']) > 0:
				parse_error(ln, 'code command cannot have both inline and block code')
				return True
			ostack[-1].append({'command': 'code', 'line': ln, 'code': r.group(1)})
			return True
		ostack[-1].append({'command': 'code', 'line': ln, 'code': parse_raw(ln, d, r.group(1))})
		return True

	if parse_anim(ln, c, d, ostack):
		return True

	if len(d['children']) > 0:
		parse_error(ln, 'unexpected indent')
		return False

	# $
	if c[0] == '$':
		ostack[-1].append({'command': 'code', 'line': ln, 'code': c[1:].strip()})
		return True

	# break, continue
	if c in ('break', 'continue'):
		ostack[-1].append({'command': c, 'line': ln})

	# label, goto
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

	# video
	r = re.match(r'video\s*(.*)\s*$', c)
	if r is not None:
		ostack[-1].append({'command': 'video', 'line': ln, 'video': r.group(1)})
		return True

	# answer
	r = re.match(r'answer\s*(.*)\s*$', c)
	if r is not None:
		ostack[-1].append({'command': 'answer', 'line': ln, 'answer': r.group(1)})
		return True

	# sprite
	r = re.match(r'sprite\s*(.*?)(?:\s+as\s+(\S+))?\s*$', c)
	if r is not None:
		sprite = r.group(1)
		tag = r.group(2) or sprite.rsplit('/', 1)[1]
		ostack[-1].append({'command': 'sprite', 'line': ln, 'sprite': sprite, 'tag': tag})
		return True

	parse_error(ln, 'syntax error')
	return True

def get_file(group, section, filename): # {{{
	global errors
	errors = []
	with open(filename) as f:
		data = read_structure(f)
	istack = [data]
	ret = []
	ostack = [ret]
	index = {'label': {}, 'goto': {}}
	while len(istack) > 0:
		d = istack[-1].pop(0)
		ln = d['line']
		parse_line(d, ln, istack, ostack, index)
		while len(istack) > 0 and len(istack[-1]) == 0:
			istack.pop()
			ostack.pop()
	for label in index['goto']:
		source = ret[index['goto'][label]]
		if label not in index['label']:
			parse_error(source['line'], 'undefined label')
		else:
			source['target'] = index['label'][label]
	return ret, errors
# }}}

def get(group, section): # {{{
	'''Get the program for a section.'''
	content_dir = os.path.join(config['data'], 'users', group.lower(), 'Content')
	filename = os.path.join(content_dir, section[0], section[1] + '.script')
	if not os.path.exists(filename):
		debug(1, 'Error: file {} does not exist'.format(filename))
		return [], {}
	return get_file(group, section, filename)
# }}}

def load822(filename):
	'''Read a file in RFC 822 format.
	Returns a dict of str keys and list[str] values.'''
	ret = {}
	with open(filename) as f:
		indent = False
		current = None
		for line in f:
			if line.strip() == '' or line.startswith('#'):
				continue
			# Handle indentation: start long value.
			if len(line.lstrip()) != len(line):
				assert indent is not False
				if indent is not None:
					# Existing indentation.
					assert line.startswith(indent)
				else:
					# New indentation (first line of indented block).
					indent = line[:-len(line.lstrip())]
				# Add line to current value.
				ret[current].append(line[len(indent):])
			else:
				# New key.
				if ':' in line.strip()[:-1]:
					# Line contains ':', so this is a single line value.
					indent = False	# Don't allow indented block.
					key, value = line.split(':', 1)
					# Insert value as single element list.
					ret[key.strip()] = [value.strip()]
				else:
					# Line does not contain ':', so it must be at the end: expect indeted block.
					assert line.strip()[-1] == ':'
					indent = None
					current = line.strip()[:-1].strip()
					# Insert empty value, which is filled by indented block.
					ret[current] = []
	return ret

# vim: set foldmethod=marker :
