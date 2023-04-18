supernovel:
	./supernovel --allow-local --default-userdata http://localhost:8879 --loglimit 2

userdata:
	cd ../userdata && ./userdata

.PHONY: supernovel userdata
