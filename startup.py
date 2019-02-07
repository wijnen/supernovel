import re
import math
import random

def test(value, target, error = 1e-3):
	return value is not None and abs(value - target) < target * error

def ans(x):
	answer("yellow" if x is None else "green" if x else "red")
	return "Ik weet niet of dat klopt, sorry" if x is None else "Goed zo, dat klopt!" if x else "Helaas, dat klopt niet"

def get_num_answers(question):
	return len(user['answers'][user['section']][question])

def get_answer(question, index = -1):
	# If the requested answer doesn't exist, return None.
	try:
		return user['answers'][user['section']][question][index][0]
	except:
		return None
