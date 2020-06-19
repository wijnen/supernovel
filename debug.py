from __main__ import config
from websocketd import log

logfile = open(config['logfile'], 'a') if config['logfile'] else None

def debug(priority, message):
	if priority <= config['loglimit']:
		log(message, depth = 1)
	if logfile:
		logfile.write('{}: ({}) {}\n'.format(time.strftime('%c', time.gmtime()), priority, message))
		logfile.flush()
