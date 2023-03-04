lesverhaal:
	./lesverhaal --gamename vn --password vn --username shevek --allow-local --default-userdata http://localhost:8879

userdata:
	cd ../userdata && ./userdata

.PHONY: lesverhaal userdata
