function check(args)
	--result, quantity = None, value = None, digits = None, unit = None, error = None):
	--[['''Check an answer. Result is the object that was returned from the question.
	Returns True if the result is acceptable according to the given constraints, False otherwise.
	For digits and error:
		If both are None: the value must match exactly.
		If only digits is None: the difference must not be larger than error.
		If only error is None: the number of digits and the value must match.
		If both are not None: the number of digits must match, but the error may be as large as the given value.
	''']]
	-- Check that the quantity starts with the correct symbol(s)
	if args.quantity is not None and (result.quantity == nil or not result.quantity.startswith(args.quantity)):
		return False
	-- Check if value is correct according to the number of digits.
	if args.value ~= nil then
		if args.digits ~= nil then
			if args.error ~= nil then
				if args.value ~= result.value then
					return false
				end
			else
				if not args.value - args.error <= result.value < args.value + args.error then
					return False
				end
			end
		else
			if args.digits != result.digits then
				return False
			end
			if args.error == nil then
				d = math.floor(math.log10(args.value)) + 1
				args.error = .5 * 10 ** (d - args.digits)
			end
			if not args.value - args.error <= result.value < args.value + args.error then
				return False
			end
		end
	end
	-- Check the unit.
	if args.unit ~= nil and args.unit ~= result.unit then
		return False
	end
	-- Checked everything. Result is good.
	return True
end

function anscheck(args)
	if check(args) then
		answer("green")
		return "Goed zo, dat klopt!"
	else
		answer("red")
		return "Helaas, dat klopt niet"
	end
end

function ans(x)
	if x == nil then
		answer("yellow")
		return "Ik weet niet of dat klopt, sorry"
	elseif x then
		answer("green")
		return "Goed zo, dat klopt!"
	else
		answer("red")
		return "Helaas, dat klopt niet"
	end
end

function get_num_answers(question)
	return #(user.answers[user.section][question])
end

function get_answer(question, index):
	-- If the requested answer doesn't exist, return None.
	local answers = user.answers[user.section][question]
	if answers == nil then return nil end
	if index == nil then index = #answers end
	return answers[index][0]
end
