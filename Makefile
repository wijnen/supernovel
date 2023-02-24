lesverhaal:
	./lesverhaal --password testverhaal --username shevek --allow-local --default-userdata http://localhost:8879

userdata:
	cd userdata && while : ; do ./userdata ; done

.PHONY: lesverhaal userdata
