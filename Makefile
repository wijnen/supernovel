lesverhaal:
	./lesverhaal --allow-local --default-userdata http://localhost:8879 --loglimit 3

userdata:
	cd ../userdata && ./userdata

.PHONY: lesverhaal userdata
