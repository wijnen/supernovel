import math

def test(value, target, error = 1e-3):
	return value is not None and abs(value - target) < target * error

def ans(x):
	answer("yellow" if x is None else "green" if x else "red")
