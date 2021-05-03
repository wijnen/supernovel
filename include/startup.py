import re
import math
import random

def check(result, quantity = None, value = None, digits = None, unit = None, error = None):
	'''Check an answer. Result is the object that was returned from the question.
	Returns True if the result is acceptable according to the given constraints, False otherwise.
	For digits and error:
		If both are None: the value must match exactly.
		If only digits is None: the difference must not be larger than error.
		If only error is None: the number of digits and the value must match.
		If both are not None: the number of digits must match, but the error may be as large as the given value.
	'''
	try:
		# Check that the quantity starts with the correct symbol(s)
		if quantity is not None and (result['quantity'] is None or not result['quantity'].startswith(quantity)):
			return False
		# Check if value is correct according to the number of digits.
		if value is not None:
			if digits is None:
				if error is None:
					if value != result['value']:
						return False
				else:
					if not value - error <= result['value'] < value + error:
						return False
			else:
				if digits != result['digits']:
					return False
				if error is None:
					d = math.floor(math.log10(value)) + 1
					error = .5 * 10 ** (d - digits)
				if not value - error <= result['value'] < value + error:
					return False
		# Check the unit.
		if unit is not None and unit != result['unit']:
			return False
		# Checked everything. Result is good.
		return True
	except:
		return False

def anscheck(*a, **ka):
	ret = check(*a, **ka)
	answer("green" if ret else "red")
	return "Goed zo, dat klopt!" if ret else "Helaas, dat klopt niet"

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
