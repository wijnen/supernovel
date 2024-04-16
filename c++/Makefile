all: supernovel.elf

WEBLOOPDIR = ../webloop/include
WEBLOOPFILES = coroutine.hh fhs.hh loop.hh network.hh tools.hh url.hh webobject.hh websocketd.hh

WEBLOOP_CXXFLAGS = -std=c++23 -I${WEBLOOPDIR}
WEBLOOP_LDFLAGS = -std=c++23 -Wl,-rpath=../webloop/.libs -L../webloop/.libs 
WEBLOOP_LIBS = -lwebloop
LUAU_CXXFLAGS = -std=c++23 -I. `pkg-config --cflags lua5.1`
LUAU_LIBS = `pkg-config --libs lua5.1`
CXXFLAGS = -Wall -Wextra -fstack-protector-strong -D_FORTIFY_SOURCE=3 -Werror ${WEBLOOP_CXXFLAGS} -ggdb3 ${LUAU_CXXFLAGS}
#CXXFLAGS = -std=c++23 `pkgconf --cflags webloop`
LDFLAGS = -ggdb3 ${WEBLOOP_LDFLAGS}
LIBADD = ${WEBLOOP_LIBS} ${LUAU_LIBS}

DEPS = Makefile userdata.hh $(addprefix ${WEBLOOPDIR}/webloop/,${WEBLOOPFILES})

%.o: %.cc ${DEPS}
	g++ ${CPPFLAGS} ${CXXFLAGS} -o $@ -c $<

%.elf: %.o luau.o Makefile
	g++ ${LDFLAGS} $(filter %.o,$^) -o $@ ${LIBADD}

test: supernovel.elf
	./supernovel.elf ${ARGS}

valgrind: supernovel.elf
	valgrind --xtree-memory=full --read-var-info=yes --track-origins=yes --vgdb=full --vgdb-error=0 ./supernovel.elf ${ARGS}

clean:
	rm -f *.o *.elf

.PHONY: test valgrind clean
