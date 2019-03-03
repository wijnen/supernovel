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

def parse_transition(transition, at): # {{{
	'''Parse a transition that was specified by "with".
	Returns: (csskey, seconds, from, to)
	'''
	timing = .5
	if not transition:
		return ('left', 0, '', at)
	if transition == 'move':
		return ('left', timing, '', at)
	elif transition == 'moveinleft':
		return ('left', timing, '-20%', at)
	elif transition == 'moveinright':
		return ('left', timing, '120%', at)
	elif transition == 'moveoutleft':
		return ('left', timing, '', '-20%')
	elif transition == 'moveoutright':
		return ('left', timing, '', '120%')
	elif transition == 'dissolve':
		return ('opacity', timing, '0%', '100%')
	else:
		debug(1, 'unknown transition: {}'.format(repr(transition)))
		return ('left', 0, '', at)
# }}}

def showhide(show, tag, mod, at, transition, characters, in_with, after, hiders, nr): # {{{
	'''Create event list for showing or hiding a character.'''
	ret = []
	if not in_with:
		after = []
	if not at:
		at = 'center'
	names = {'left': '30%', 'right': '70%', 'center': '50%'}
	if at in names:
		at = names[at]
	if tag not in characters:
		debug(1, '{}: error: unknown character tag {}'.format(nr, tag))
		return []
	name, imgs, ext = characters[tag]
	if transition:
		transition = parse_transition(transition, at)
	if in_with:
		if not transition:
			transition = in_with
		if transition[3] is None:
			transition = transition[:3] + (at,)
		transition = (transition[0], in_with[1]) + transition[2:]
	elif not transition:
		transition = parse_transition(None, at)
	if show:
		# When showing, define the image first.
		url = imgs + (mod if mod else 'default') + ext
		ret.append(['image', tag, url])
	if transition[2]:
		# There is a from position specified.  Place the image there without a transition.
		ret.append(['style', tag, 'transition', ''])
		ret.append(['style', tag, transition[0], transition[2]])
	if transition[1]:
		# Timing is specified.  Apply it.
		after.append(['style', tag, 'transition', transition[0] + ' ' + str(transition[1]) + 's'])
	if show or transition[1]:
		# This is not an instantaneous hide.  Set the position.
		after.append(['style', tag, transition[0], transition[3]])
	if transition[1] and not in_with:
		# Timing is specified.  Wait for it.
		after.append(['wait', transition[1]])
	if not show:
		# When hiding, (un)define the image last.
		if in_with:
			hiders.append(['image', tag, ''])
		else:
			after.append(['image', tag, ''])
	if not in_with:
		ret.append(['pre-wait'])
		ret.extend(after)
	return ret
# }}}

def get_file(filename): # {{{
	with open(filename) as f:
		parts = []
		stack = [parts]
		istack = [None]
		index = {}
		characters = {}
		labels = []
		last_label = ''
		in_string = False
		in_comment = False
		in_speech = False
		in_with = False
		after = []
		hiders = []
		pending_emote = [None]
		def add_story_item(item = None):
			finish_story_item(item)
			if len(stack) == 0 or len(stack[-1]) == 0 or stack[-1][-1][0] != 'story':
				stack[-1].append(['story', None, []])
			if item is not None:
				if isinstance(item, str) and len(stack[-1][-1][2]) > 0 and isinstance(stack[-1][-1][2][-1], str):
					stack[-1][-1][2][-1] += '\n' + item
				else:
					stack[-1][-1][2].append(item)
		def finish_story_item(item = None):
			# If there is no story item, do nothing.
			if len(stack[-1]) < 1 or len(stack[-1][-1]) < 1 or stack[-1][-1][0] != 'story':
				return
			# If there is no pending emote in the story, do nothing.
			if pending_emote[0] is None:
				return
			p = pending_emote[0]
			# If the new item is a question, don't bother restoring the image.
			if isinstance(item, str):
				pass
			elif item is not None and item[0] == 'image':
				if item[1] == p:
					# My image is set. Don't change to pending.
					pending_emote[0] = None
					return
				else:
					# Someone else's image: don't change image yet.
					return
			else:
				pending_emote[0] = None
				name, imgs, ext = characters[p]
				if imgs and ext:
					add_story_item(['image', p, imgs + 'default' + ext])
		for nr, ln in enumerate(f):
			ln = ln.rstrip()
			if in_string:
				if ln.strip() != '' and ln[:istack[-1]].strip() != '':
					debug(1, '{}: indentation error in block string'.format(nr))
				ln = ln[istack[-1]:]
				if ln.endswith(in_string):
					ln = ln[:-len(in_string)].rstrip()
					in_string = False
					if ln != '':
						add_story_item(ln)
					continue
				add_story_item(ln)
				continue
			if in_comment:
				if ln.strip() != '' and ln[:istack[-1]].strip() != '':
					debug(1, '{}: indentation error in block comment'.format(nr))
				if ln.endswith('###'):
					in_comment = False
				continue
			if in_speech:
				if ln.strip() == '' or ln[:istack[-1]].strip() == '':
					stack[-1][-1][2] += '\n' + ln[istack[-1]:]
					continue
				in_speech = False
				istack.pop()
			ilevel = len(ln) - len(ln.strip())
			ln = ln.strip()
			if ln.startswith('###'):
				if len(ln) > 3 and ln.endswith('###'):
					continue
				in_comment = True
				continue
			if ln.startswith('#') or ln == '':
				continue
			if istack[-1] is None:
				if len(istack) > 1 and ilevel <= istack[-2]:
					debug(1, '{}: indented block expected'.format(nr))
					istack[-1] = istack[-2]
				else:
					istack[-1] = ilevel
			while ilevel < istack[-1]:
				istack.pop()
				if in_with:
					# Finish animation.
					stack[-1][-1][2].append(['pre-wait'])
					stack[-1][-1][2].extend(after)
					stack[-1][-1][2].append(['wait', in_with[1]])
					stack[-1][-1][2].extend(hiders)
					in_with = False
				else:
					stack.pop()
			if ilevel != istack[-1]:
				debug(1, '{}: unexpected indentation'.format(nr))
			if len(istack) >= 2 and istack[-2] is None:
				istack[-2] = istack[-1]
			if ln.strip().startswith("'''") or ln.strip().startswith('"""'):
				in_string = ln[:3]
				ln = ln[3:]
				if ln.endswith(in_string):
					ln = ln[:-len(in_string)].rstrip()
					in_string = False
					add_story_item(ln)
					continue
				add_story_item()
				if ln != '':
					add_story_item(ln)
				continue
			r = re.match(r'(["\'])(.*)\1\s*$', ln)
			if r:
				add_story_item(r.group(2))
				continue
			r = re.match(r'answer\s+((.+?)\s+)?(.+?)\s*$', ln)
			if r:
				finish_story_item()
				stack[-1].append(['answer', None, r.group(2), r.group(3)])
				continue
			r = re.match(r'label\s+(.+?)\s*$', ln)
			if r:
				# Labels are only allowed at top level.
				if len(stack) != 1:
					debug(1, '{}: labels are only allowed at top level'.format(nr))
					continue
				name = r.group(1)
				if name.startswith('.'):
					name = last_label + name
				else:
					last_label = name
				index[name] = len(stack[-1])
				stack[-1].append(['label', None, name]) # Label name is not used, but good for debugging.
				continue
			r = re.match(r'goto\s+(.+?)\s*$', ln)
			if r:
				name = r.group(1)
				if name.startswith('.'):
					name = last_label + name
				finish_story_item()
				stack[-1].append(['goto', None, 0]) # Label is filled in at end.
				labels.append((name, stack[-1][-1]))
				continue
			r = re.match(r'if\s+(.+):$', ln)
			if r:
				finish_story_item()
				stack[-1].append(['if', None, [r.group(1), []], None])
				stack.append(stack[-1][-1][-2][1])
				istack.append(None)
				continue
			r = re.match(r'elif\s+(.+):$', ln)
			if r:
				if stack[-1][-1][0] != 'if':
					debug(1, '{}: elif without if'.format(nr))
					continue
				if stack[-1][-1][-1] is not None:
					debug(1, '{}: elif after else'.format(nr))
					continue
				stack[-1][-1].insert(-1, [r.group(1), []])
				stack.append(stack[-1][-1][-2][1])
				istack.append(None)
				continue
			r = re.match(r'else\s*:$', ln)
			if r:
				if stack[-1][-1][0] != 'if':
					debug(1, '{}: else without if'.format(nr))
					continue
				if stack[-1][-1][-1] is not None:
					debug(1, '{}: else after else'.format(nr))
					continue
				stack[-1][-1][-1] = []
				stack.append(stack[-1][-1][-1])
				istack.append(None)
				continue
			r = re.match(r'while\s+(.+):$', ln)
			if r:
				finish_story_item()
				stack[-1].append(['while', None, r.group(1), []])
				stack.append(stack[-1][-1][3])
				istack.append(None)
				continue
			if ln in ('continue', 'break'):
				finish_story_item()
				stack[-1].append([ln, None])
				continue
			r = re.match(r'character\s+(\S+)(\s+(\S+)(\s+(.*?))?)?\s*$', ln)
			if r:
				tag = r.group(1)
				url = r.group(3)
				name = r.group(5)
				if url == '-':
					fulldir = None
					ext = None
				else:
					imgdir, ext = os.path.splitext(url)
					if imgdir.startswith('common/'):
						fulldir = config['content'] + '/' + imgdir + '/'
					else:
						fulldir = config['content'] + '/' + group.lower() + '/' + section[0] + '/' + section[1] + '/' + imgdir + '/'
				characters[tag] = (name, fulldir, ext)
				continue
			r = re.match(r'scene(\s+(.*?))?$', ln)
			if r:
				if r.group(2):
					if r.group(2).startswith('common/'):
						url = config['content'] + '/' + r.group(2)
					else:
						url = config['content'] + '/' + group.lower() + '/' + section[0] + '/' + section[1] + '/' + r.group(2)
				else:
					url = None
				add_story_item(['scene', url])
				continue
			r = re.match(r'(show|hide)\s+(\S+)(\s+(\S*))?(\s+at\s+(.*?))?(\s+with\s+(.*?))?$', ln)
			if r:
				show = r.group(1) == 'show'
				tag = r.group(2)
				mod = r.group(4)
				at = r.group(6)
				transition = r.group(8)
				add_story_item()
				stack[-1][-1][2].extend(showhide(show, tag, mod, at, transition, characters, in_with, after, hiders, nr))
				continue
			r = re.match(r'with\s+(\S+)\s*:$', ln)
			if r:
				if in_with:
					debug(1, '{}: error: nested with blocks'.format(nr))
				in_with = parse_transition(r.group(1), None)
				after = []
				hiders = []
				istack.append(None)
				continue
			r = re.match(r'say\s+(.)(.*?)\1:\s+(.*)$', ln)
			if r:
				add_story_item(['text', r.group(2), r.group(3), None])
				if r.group(3) == '':
					in_speech = True
					istack.append(None)
				continue
			if ln.startswith('$'):
				if len(stack[-1]) > 0 and stack[-1][-1][0] == 'python':
					if ln[1:1 + indent].strip() != '':
						debug(1, '{}: python indentation must be at least the initial indentation'.format(nr))
						continue
				else:
					indent = len(ln) - len(ln[1:].strip()) - 1
					finish_story_item()
					stack[-1].append(['python', None, []])
				stack[-1][-1][2].append(ln[1 + indent:])
				continue
			r = re.match(r'video\s+(.+)$', ln)
			if r:
				finish_story_item()
				stack[-1].append(['video', None, r.group(1).strip()])
				continue
			r = re.match(r'(number|unit|short|long|longnumber|longunit|longshort)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*$', ln)
			if r:
				finish_story_item()
				stack[-1].append([r.group(1), None, r.group(2)])
				continue
			r = re.match(r'((long)?choice)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*$', ln)
			if r:
				finish_story_item()
				stack[-1].append([r.group(1), None, r.group(3)])
				continue
			r = re.match(r'option\s+(.*)$', ln)
			if r:
				if len(stack[-1]) < 1 or len(stack[-1][-1]) < 1 or stack[-1][-1][0] not in ('choice', 'longchoice'):
					debug(1, '{}: option must immediately follow choice or longchoice'.format(nr))
					continue
				stack[-1][-1].append(r.group(1).strip())
				continue
			r = re.match(r'hidden\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+(.*)$', ln)
			if r:
				if len(stack[-1]) > 0 and len(stack[-1][-1]) > 0 and stack[-1][-1][0] == 'story':
					debug(1, '{}: hidden answer must not appear in the middle of a story'.format(nr))
					continue
				stack[-1].append(['hidden', None, r.group(1), r.group(2)])
				continue
			r = re.match(r'(.*?)(?:\s+(.*?))?\s*:\s*(.*?)\s*$', ln)
			if r and r.group(1) in characters:
				name, imgs, ext = characters[r.group(1)]
				if r.group(2) is not None:
					add_story_item(['image', r.group(1), imgs + r.group(2) + ext])
				add_story_item(['text', name, r.group(3), imgs + 'side' + ext if imgs else None])
				pending_emote[0] = r.group(1)
				if not r.group(3):
					in_speech = True
					istack.append(None)
				continue
			debug(1, 'invalid line: ' + ln)
		for label, src in labels:
			src[2] = index[label]
	# Create all paths.
	def make_paths(path, items):
		for i, item in enumerate(items):
			item[1] = path + (i,)
			if item[0] == 'while':
				make_paths(path + (i,), item[3])
			elif item[0] == 'if':
				for n, target in enumerate(item[2:-1]):
					make_paths(path + (i, n), target[1])
				if item[-1] is not None:
					make_paths(path + (i, len(item) - 2), item[-1])
	make_paths((), parts)
	return parts, index, characters
# }}}

def get(group, section): # {{{
	'''Get the program for a section.'''
	content_dir = os.path.join(config['data'], 'users', group.lower(), 'Content')
	filename = os.path.join(content_dir, section[0], section[1] + '.script')
	if not os.path.exists(filename):
		debug(1, 'Error: file {} does not exist'.format(filename))
		return [], {}
	return get_file(filename)
# }}}

# vim: set foldmethod=marker :
