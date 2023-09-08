supernovel:
	./supernovel --allow-local --loglimit 2 --no-allow-other

userdata:
	cd ../userdata && ./userdata

.PHONY: supernovel userdata
