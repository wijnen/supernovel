all: supernovel.elf

DEBUG_WEBLOOP = 1

ifdef DEBUG_WEBLOOP
WEBLOOPDIR = ../../webloop/include
WEBLOOPFILES = coroutine.hh fhs.hh loop.hh network.hh tools.hh url.hh webobject.hh websocketd.hh
WEBLOOP_CXXFLAGS = -std=c++23 -I${WEBLOOPDIR}
WEBLOOP_LDFLAGS = -std=c++23 -Wl,-rpath=../../webloop/.libs -L../../webloop/.libs
WEBLOOP_LIBS = -lwebloop
WEBLOOP_DEPS = $(addprefix ${WEBLOOPDIR}/webloop/,${WEBLOOPFILES})
else
WEBLOOP_CXXFLAGS = `pkgconf --cflags webloop`
WEBLOOP_LDFLAGS = `pkgconf --libs-only-L --libs-only-other webloop`
WEBLOOP_LIBS = `pkgconf --libs-only-l webloop`
WEBLOOP_DEPS =
endif

LUA_CXXFLAGS = `pkg-config --cflags lua5.1`
LUA_LDFLAGS = `pkg-config --libs-only-L --libs-only-other lua5.1`
LUA_LIBS = `pkg-config --libs-only-l lua5.1`

CXXFLAGS = -Wall -Wextra -fstack-protector-strong -D_FORTIFY_SOURCE=3 -Werror ${WEBLOOP_CXXFLAGS} -ggdb3 ${LUA_CXXFLAGS}
#LDFLAGS = -fno-omit-frame-pointer -fsanitize=address -ggdb3 ${LUA_LDFLAGS} ${WEBLOOP_LDFLAGS}
LDFLAGS = -fno-omit-frame-pointer -ggdb3 ${LUA_LDFLAGS} ${WEBLOOP_LDFLAGS}
#LDFLAGS = -static -fno-omit-frame-pointer -ggdb3 ${LUA_LDFLAGS} ${WEBLOOP_LDFLAGS}
LIBADD = ${WEBLOOP_LIBS} ${LUA_LIBS}

DEPS = Makefile userdata.hh $(WEBLOOP_DEPS)

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
