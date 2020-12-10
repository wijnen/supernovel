#!/usr/bin/python3

# Imports and config. {{{
import os
import re
import json
import traceback
from websocketd import log
from __main__ import config
from debug import debug
# }}}

users = {}	# including admins.
admins = {}
# Keys which are never saved.
unsaved = ['connection', 'text_buffer', 'full_section', 'run_stack', 'section', 'answers', 'variables', 'last_path', 'characters', 'cookie', 'python']

def load(name, group): # {{{
	# Set default user data; can be replaced (or not returned) below.
	ret = {'filename': name.lower(), 'name': name, 'group': group.lower(), 'connection': None, 'password': None, 'nosave': False, 'sandbox': False, 'answers': {}}
	if not os.path.exists(os.path.join(config['data'], 'users', group.lower())):
		debug(0, 'user.load called for nonexistent group {}:{}'.format(name, group))
		return None
	if not os.path.exists(os.path.join(config['data'], 'users', group.lower(), name.lower())):
		if os.path.exists(os.path.join(config['data'], 'users', group.lower(), 'Open')):
			# Create new user.
			save(ret)
		else:
			debug(0, 'user.load called for nonexistent user {}:{}'.format(name, group))
			return None
	if (name.lower(), group.lower()) in users:
		ret = users[(name.lower(), group.lower())]
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
			if (c, s) not in ret['answers']:
				ret['answers'][(c, s)] = {}
			try:
				ret['answers'][(c, s)][q] = [json.loads(a) for a in value.split(';')]
				assert all('raw' in x for x in ret['answers'][(c, s)][q])
				assert all('style' in x for x in ret['answers'][(c, s)][q])
			except:
				ret['answers'][(c, s)][q] = [{'raw': a, 'style': []} for a in value.split(';')]
			continue
		ret[key] = value.rstrip('\n')
	# Make sure name and group match file location.
	if ret['filename'] != name.lower():
		ret['filename'] = name.lower()
	if ret['group'].casefold() != group.casefold():
		ret['group'] = group
	return ret
# }}}

def list_groups(): # {{{
	path = os.path.join(config['data'], 'users')
	ret = [p for p in os.listdir(path) if os.path.isdir(os.path.join(path, p)) and p.lower() == p and p != 'admin']
	ret.sort()
	return ret
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
			if user[key] is None or key in unsaved:
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
					f.write('answer:{}:{}:{}={}\n'.format(s[0], s[1], q, ';'.join(json.dumps(a) for a in question)))
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
