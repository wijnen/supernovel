#!/usr/bin/python3

# Imports and config. {{{
import os
import re
import traceback
from websocketd import log
from __main__ import config
from debug import debug
# }}}

users = {}	# including admins.
admins = {}
# Keys which are never saved.
unsaved = ('connection', 'text_buffer', 'full_section', 'run_stack', 'section', 'answers', 'variables', 'last_path', 'characters', 'cookie')

def mangle(src): # {{{
	def escape(x):
		return x.replace('\\', '\\\\').replace(';', '\,').replace(':', '\.').replace('\n', '\\n')
	styles = ':' + ':'.join(escape('/'.join(s)) for s in src[1])
	answer = src[0]
	if isinstance(answer, int):
		return 'i{}'.format(answer) + styles
	if isinstance(answer, float):
		return 'f{}'.format(answer) + styles
	if isinstance(answer, tuple):
		if isinstance(answer[0], tuple):
			if answer[0][0] is None:
				return 'U/{}/{}'.format(escape(answer[0][1]), escape(answer[1]))
			return 'U{}/{}/{}'.format(answer[0][0], escape(answer[0][1]), escape(answer[1])) + styles
		if answer[0] is None:
			return 'F/{}'.format(escape(answer[1])) + styles
		if isinstance(answer[0], int):
			return 'I{}/{}'.format(answer[0], escape(answer[1])) + styles
		elif isinstance(answer[0], float):
			return 'F{}/{}'.format(answer[0], escape(answer[1])) + styles
		else:
			return 'S{}/{}'.format(answer[0], escape(answer[1])) + styles
	try:
		return 's' + escape(answer) + styles
	except:
		debug(1, 'Error: unable to mangle {}'.format(repr(src)))
		return 's' + escape(repr(src)) + styles
# }}}

def unmangle(src): # {{{
	# 'answer:key/value:key/value'
	def unescape(x):
		return x.replace('\\n', '\n').replace('\\.', ':').replace('\\,', ';').replace('\\/', '\\').strip()
	try:
		parts = src.split(':')
		answer = parts[0]
		styles = []
		for p in parts[1:]:
			if '/' not in p:
				continue
			key, value = p.split('/', 1)
			styles.append((unescape(key), unescape(value)))
		if answer[0] == 'i':
			return int(answer[1:]), styles
		if answer[0] == 'f':
			return float(answer[1:]), styles
		if answer[0] == 's':
			return unescape(answer[1:]), styles
		if answer[0] == 'I':
			r = re.match(r'I(.*?)/(.*)$', answer)
			if not r:
				debug(1, 'Error unmangling long int: {}'.format(answer))
				return (None, unescape(answer)), styles
			return (int(r.group(1)), unescape(r.group(2))), styles
		if answer[0] == 'F':
			r = re.match(r'F(.*?)/(.*)$', answer)
			if not r:
				debug(1, 'Error unmangling long float: {}'.format(answer))
				return (None, unescape(answer)), styles
			if r.group(1) == '':
				return (None, unescape(r.group(2))), styles
			return (float(r.group(1)), unescape(r.group(2))), styles
		if answer[0] == 'S':
			r = re.match(r'S(.*?)/(.*)$', answer)
			if not r:
				debug(1, 'Error unmangling long string: {}'.format(answer))
				return (None, unescape(answer)), styles
			return (unescape(r.group(1)), unescape(r.group(2))), styles
		if answer[0] == 'U':
			r = re.match(r'U(.*?)/(.*?)/(.*)$', answer)
			if not r:
				debug(1, 'Error unmangling long unit: {}'.format(answer))
				return ((None, ''), unescape(answer)), styles
			if r.group(1) == '':
				return ((None, unescape(r.group(2))), unescape(r.group(3))), styles
			return ((float(r.group(1)), unescape(r.group(2))), unescape(r.group(3))), styles
	except:
		traceback.print_exc()
		pass
	debug(1, 'Error unmangling: invalid first character of {}'.format(repr(src)))
	return src, ()
# }}}

def load(name, group): # {{{
	if not os.path.exists(os.path.join(config['data'], 'users', group.lower())):
		debug(0, 'user.load called for nonexistent group {}:{}'.format(name, group))
		return None, {}
	if not os.path.exists(os.path.join(config['data'], 'users', group.lower(), name.lower())):
		debug(0, 'user.load called for nonexistent user {}:{}'.format(name, group))
		return None, {}
	if (name.lower(), group.lower()) in users:
		ret = users[(name.lower(), group.lower())]
	else:
		ret = {'filename': name.lower(), 'name': name, 'group': group.lower(), 'connection': None, 'password': None, 'nosave': False, 'sandbox': False}
	answers = {}
	for ln in open(os.path.join(config['data'], 'users', group.lower(), name.lower()), errors = 'replace'):
		if ln.strip() == '':
			continue
		try:
			key, value = ln.strip().split('=', 1)
		except ValueError:
			log('Failed to parse line from user config for %s:%s: %s' % (name, group, ln.strip()))
			continue
		if key in unsaved:
			# This key should not have been in the file.
			continue
		if key in ('nosave', 'sandbox'):
			ret[key] = value == 'True'
			continue
		if key.startswith('answer:'):
			try:
				a, c, s, q = key.split(':', 3)
			except:
				log('Failed to parse answer key {}; ignoring'.format(key))
				continue
			if (c, s) not in answers:
				answers[(c, s)] = {}
			answers[(c, s)][q] = [unmangle(a) for a in value.split(';')]
			continue
		ret[key] = value.rstrip('\n')
	# Make sure name and group match file location.
	if ret['filename'] != name.lower():
		ret['filename'] = name.lower()
	if ret['group'].casefold() != group.casefold():
		ret['group'] = group
	return ret, answers
# }}}

def list_group(group): # {{{
	path = os.path.join(config['data'], 'users', group.lower())
	if not os.path.exists(path):
		debug(0, 'list_group called for nonexistent group {}'.format(group))
		return []
	return [p for p in os.listdir(path) if p == p.lower() and not os.path.isdir(os.path.join(path, p))]
# }}}

def save(user): # {{{
	'''Save user information to disk.'''
	with open(os.path.join(config['data'], 'users', user['group'].lower(), user['filename']), 'w', errors = 'replace') as f:
		for key in user:
			if key in unsaved:
				continue
			f.write('{}={}\n'.format(key, user[key]))
		# Record answers.
		if not user['nosave'] and 'answers' in user:
			for s in user['answers']:
				if s[0] == 'sandbox':
					continue
				section = user['answers'][s]
				for q in section:
					question = section[q]
					f.write('answer:{}:{}:{}={}\n'.format(s[0], s[1], q, ';'.join(mangle(a) for a in question)))
# }}}

def save_all(): # {{{
	for user in users:
		save(user)
# }}}

def refresh_admins(): # {{{
	for a in admins:
		admins[a].refresh()
# }}}

# vim: set foldmethod=marker :
