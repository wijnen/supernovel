#include "luau.hh"
#include <lua.h>
#include <lauxlib.h>
#include <cstring>

using namespace Webloop;

namespace Luau {

class LuaPtr : public std::shared_ptr <WebObject> { // {{{
public:
	void *operator new(size_t size, lua_State *state) {
		return lua_newuserdata(state, size);
	}
	void operator delete(void *ptr, size_t size) {
		// Nothing to do here; Lua will free the memory.
		// Note that the gc metamethod must call delete to make sure the destructor is called.
		(void)&ptr;
		(void)&size;
	}
}; // }}}

static void stack_push(lua_State *state, std::shared_ptr <WebObject> object) { // {{{
	switch(object->get_type()) {
	case WebObject::NONE:
		lua_pushnil(state);
		break;
	case WebObject::BOOL:
		lua_pushboolean(state, bool(*object->as_bool()));
		break;
	case WebObject::INT:
		lua_pushinteger(state, WebObject::IntType(*object->as_int()));
		break;
	case WebObject::FLOAT:
		lua_pushnumber(state, WebObject::FloatType(*object->as_float()));
		break;
	case WebObject::STRING:
	{
		std::string str(*object->as_string());
		lua_pushlstring(state, str.data(), str.size());
		break;
	}
	default:
	{
		// Create userdata. It is pushed onto the stack.
		new (state) LuaPtr(object);		// Stack after this: new object
		// Set metatable.
		lua_pushstring(state, "meta");		// Stack after this: "meta" / new object
		lua_rawget(state, LUA_REGISTRYINDEX);	// Stack after this: meta table / new object
		lua_setmetatable(state, -2);		// Stack after this: new object
		break;
	}
	}
} // }}}

std::shared_ptr <WebObject> stack_read(lua_State *state, int i) { // {{{
	int t = lua_type(state, i);
	switch(t) {
	case LUA_TNIL:
		return WebNone::create();
	case LUA_TNUMBER:
	{
		lua_Number n = lua_tonumber(state, i);
		WebObject::IntType i(n);
		if (n - i == 0)
			return WebInt::create(i);
		return WebFloat::create(n);
	}
	case LUA_TBOOLEAN:
		return WebBool::create(lua_toboolean(state, i));
	case LUA_TSTRING:
	{
		size_t len;
		const char *str = lua_tolstring(state, i, &len);
		return WebString::create(std::string(str, len));
	}
	case LUA_TTABLE:
		// Wrap table into LuaTable and return it.
		lua_pushvalue(state, i);
		return LuaTable::create(state);
	case LUA_TFUNCTION:
		// Wrap function into LuaFunction and return it.
		lua_pushvalue(state, i);
		return LuaFunction::create(state);
	case LUA_TUSERDATA:
	{
		// Unwrap WebObject from userdata and return it.
		auto ptr = reinterpret_cast <std::shared_ptr <WebObject> *>(lua_touserdata(state, i));
		return *ptr;
	}
	case LUA_TTHREAD:
		// Wrap thread into LuaThread and return it.
		lua_pushvalue(state, i);
		return LuaThread::create(state);
	case LUA_TLIGHTUSERDATA:
		// This should never happen.
		throw "BUG: light userdata should not be on the stack";
	default:
		// This should never happen.
		throw "BUG: invalid type returned";
	}
} // }}}

// Context {{{
Context Context::s_default_default;
Context *Context::s_default;

void Context::stack_push(std::shared_ptr <WebObject> object) { Luau::stack_push(m_state, object); }
std::shared_ptr <WebObject> Context::stack_read(int i) const { return Luau::stack_read(m_state, i); }

// These functions could be static members of Context, but they are local static functions of this file, to keep luau.hh clean.
template <class operation>
static int s_binary_operator(lua_State *state) { // {{{
	int n = lua_gettop(state);
	if (n != 2)
		throw "invalid number of arguments to binary operator";
	auto lhs = stack_read(state, 1);
	auto rhs = stack_read(state, 2);
	auto ret = operation::run(lhs, rhs);
	stack_push(state, ret);
	return 1;
} // }}}

static int s_gc_operator(lua_State *state) { // {{{
	int n = lua_gettop(state);
	if (n != 1)
		throw "invalid number of arguments to gc operator";
	if (!lua_isuserdata(state, 1))
		throw "gc argument must be a userdata";
	if (lua_islightuserdata(state, 1))
		throw "gc argument cannot be a light userdata";
	auto ptr = reinterpret_cast <LuaPtr *>(lua_touserdata(state, 1));
	delete ptr;
	return 0;
} // }}}

struct op_add { static std::shared_ptr <WebObject> run(std::shared_ptr <WebObject> lhs, std::shared_ptr <WebObject> rhs) { return *lhs + *rhs; } };
struct op_index { static std::shared_ptr <WebObject> run(std::shared_ptr <WebObject> lhs, std::shared_ptr <WebObject> rhs) { return (*lhs)[*rhs]; } };

static void push_operator(lua_State *state, char const *op, lua_CFunction target) {
	lua_pushlstring(state, op, std::strlen(op));
	lua_pushcclosure(state, target, 0);
	lua_rawset(state, -3);
}

Context::Context() { // {{{
	m_state = luaL_newstate();
	if (!m_state)
		throw "unable to create Luau state";
	// Create metatable for userdata wrappers.
	lua_pushstring(m_state, "meta");	// Push key first, for storing the table in the registry.
	lua_createtable(m_state, 0, 18);
	// Add.
	push_operator(m_state, "__add", &s_binary_operator <op_add>);	// Add
	// Sub.
	// Mul.
	// Div.
	// Mod.
	// Pow.
	// Unm.
	// Concat.
	// Len.
	// Eq.
	// Lt.
	// Le.
	push_operator(m_state, "__index", &s_binary_operator <op_index>);	// Index
	// Newindex.
	// Call.
	push_operator(m_state, "__gc", &s_gc_operator);	// Gc
	// Close?
	// Tostring?
	lua_rawset(m_state, LUA_REGISTRYINDEX);
} // }}}

Context::~Context() { // {{{
	lua_close(m_state);
} // }}}

Context *Context::get(Context *context, bool new_default) { // {{{
	if (context == nullptr) {
		if (s_default == nullptr)
			s_default = &s_default_default;
		context = s_default;
	}
	if (new_default)
		s_default = context;
	return context;
} // }}}
// }}}

std::shared_ptr <WebObject> LuaFunction::copy() const { // {{{
	lua_rawgeti(m_state, LUA_REGISTRYINDEX, m_ref);
	return create(m_state);
} // }}}
std::shared_ptr <WebObject> LuaTable::copy() const { // {{{
	lua_rawgeti(m_state, LUA_REGISTRYINDEX, m_ref);
	return create(m_state);
} // }}}
std::shared_ptr <WebObject> LuaThread::copy() const { // {{{
	lua_rawgeti(m_state, LUA_REGISTRYINDEX, m_ref);
	return create(m_state);
} // }}}

LuaObject::LuaObject(lua_State *state, int otype) : WebObject(otype), m_state(state) { // {{{
	m_ref = luaL_ref(m_state, LUA_REGISTRYINDEX);
} // }}}

std::shared_ptr <WebObject> LuaTable::operator[](std::shared_ptr <WebObject> index) const {
	lua_rawgeti(m_state, LUA_REGISTRYINDEX, m_ref);
	stack_push(m_state, index);
	lua_gettable(m_state, -2);
	auto ret = stack_read(m_state, -1);
	lua_settop(m_state, -3);
	return ret;
}

bool LuaTable::empty() const {
	return size() == 0;
}

size_t LuaTable::size() const {
	lua_rawgeti(m_state, LUA_REGISTRYINDEX, m_ref);
	auto ret = lua_objlen(m_state, -1);
	lua_settop(m_state, -2);
	return ret;
}

void LuaTable::push_back(std::shared_ptr <WebObject> item) {
	lua_rawgeti(m_state, LUA_REGISTRYINDEX, m_ref);
	auto len = lua_objlen(m_state, -1);
	lua_pushinteger(m_state, len + 1);
	stack_push(m_state, item);
	lua_settable(m_state, -3);
	lua_settop(m_state, -2);
}

void LuaTable::pop_back() {
	lua_rawgeti(m_state, LUA_REGISTRYINDEX, m_ref);
	auto len = lua_objlen(m_state, -1);
	lua_pushinteger(m_state, len);
	lua_pushnil(m_state);
	lua_settable(m_state, -3);
	lua_settop(m_state, -2);
}

void LuaTable::insert(std::shared_ptr <WebObject> key, std::shared_ptr <WebObject> v) {
	lua_rawgeti(m_state, LUA_REGISTRYINDEX, m_ref);
	stack_push(m_state, key);
	stack_push(m_state, v);
	lua_settable(m_state, -3);
	lua_settop(m_state, -2);
}


// Thread. {{{
Thread::Thread(Context *context) : m_context(Context::get(context)), m_running(false) {}

Thread::~Thread() { // {{{
} // }}}

void Thread::set(std::string const &variable, std::shared_ptr <WebObject> value) { // {{{
	m_context->stack_push(value);
	lua_setglobal(m_context->m_state, variable.c_str());
} // }}}

coroutine Thread::run(std::string const &script, bool keep_single) { // {{{
	try {
		if (running())
			throw "attempt to run unfinished thread";
		m_running = true;
		int r = luaL_loadstring(m_context->m_state, script.c_str());
		switch(r) {
		case 0:
			break;
		case LUA_ERRSYNTAX:
			throw "syntax error in Lua script";
		case LUA_ERRMEM:
			throw "memory error while loading Lua script";
		default:
			throw "unexpected error while loading Lua script";
		}
		std::shared_ptr <WebObject> argsobj = WebVector::create();
		while (true) {
			auto args = argsobj->as_vector();
			for (size_t i = 0; i < args->size(); ++i)
				m_context->stack_push((*args)[i]);
			r = lua_resume(m_context->m_state, args->size());
			switch(r) {
			case 0: // Function returned values.
			case LUA_YIELD: // Function yielded values.
				break;
			case LUA_ERRRUN:
				throw "runtime error during Lua script";
			case LUA_ERRMEM:
				throw "memory error during Lua script";
			case LUA_ERRERR:
				throw "error in the (nonexistent) error function during Lua script";
			default:
				throw "unexpected error during Lua script";
			}
			int n = lua_gettop(m_context->m_state);
			std::shared_ptr <WebObject> ret;
			if (n == 1 && !keep_single)
				ret = m_context->stack_read(0);
			else {
				ret = WebVector::create();
				for (int i = 0; i < n; ++i)
					ret->as_vector()->push_back(m_context->stack_read(i));
			}
			lua_settop(m_context->m_state, 0);
			if (r == 0) {
				m_running = false;
				co_return ret;
			}
			else
				argsobj = Yield(ret);
		}
	}
	catch (char const *msg) {
		WL_log("Lua run exception: " + std::string(msg));
	}
	catch (std::string msg) {
		WL_log("Lua run exception: " + msg);
	}
} // }}}
// }}}

}

// vim: set foldmethod=marker :
