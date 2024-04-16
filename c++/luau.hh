#ifndef LUAU_HH
#define LUAU_HH

#include <webloop/webobject.hh>
#include <webloop/coroutine.hh>

// Declare this struct so lua.h does not need to be included here.
struct lua_State;

namespace Luau {

class Thread;

// This class holds a lua_State and is needed for any operation.
class Context { // {{{
	friend class Thread;
	lua_State *m_state;
	static Context s_default_default;
	static Context *s_default;
	void stack_push(std::shared_ptr <Webloop::WebObject> object);
	std::shared_ptr <Webloop::WebObject> stack_read(int index) const;
	// Internal functions that needs access to stack_read.
	friend int s_binary_operator(lua_State *state);
	template <class operation> friend int s_binary_operator(lua_State *state);
public:
	Context();
	~Context();
	static Context *get(Context *context = nullptr, bool new_default = false);
}; // }}}

// Helper classes for using Lua objects in C++. {{{
class LuaFunction;
class LuaTable;
class LuaThread;

// This class is the basis for all Lua objects that need to be used from C++.
// There is an object in Lua, which has an entry in the registry.
// Lua operations are performed directly on the object in Lua.
// C++ operations are performed on this object.
// It derives from WebObject, so it can be contained in other WebObjects.
class LuaObject : public Webloop:: WebObject { // {{{
protected:
	lua_State *m_state;
	int m_ref;
	// Constructor is protected, because only derived classes should be allowed to construct it.
	// object_type is passed, because it is defined static, so it is not part of this.
	LuaObject(lua_State *state, int otype);
public:
	// object_type, copy and print are not defined here, but in the derived classes.

	// TODO: map all operators onto Lua operations.

}; // }}}

// This class wraps a lua Function object and can be called from C++.
class LuaFunction : public LuaObject { // {{{
	friend class Context;
	friend std::shared_ptr <WebObject> stack_read(lua_State *state, int i);

public:
	static int const object_type = Webloop::make_object_type("LuaF");

	// Construction.
private:
	LuaFunction(lua_State *state) : LuaObject(state, object_type) {}
	static std::shared_ptr <WebObject> create(lua_State *state) { return std::shared_ptr <WebObject> (new LuaFunction(state)); }

	// Parts that are needed for WebObject.
public:
	std::shared_ptr <WebObject> copy() const override;
	std::string print() const override { return "LuaFunction"; }

	// Function specifics.
public:
	Webloop::coroutine operator()(WebObject args);

}; // }}}

// This class wraps a lua Table object and can be manipulated from C++.
class LuaTable : public LuaObject { // {{{
	friend class Context;
	friend std::shared_ptr <WebObject> stack_read(lua_State *state, int i);

public:
	static int const object_type = Webloop::make_object_type("LuaT");

	// Construction.
private:
	LuaTable(lua_State *state) : LuaObject(state, object_type) {}
	static std::shared_ptr <WebObject> create(lua_State *state) { return std::shared_ptr <WebObject> (new LuaTable(state)); }

	// Parts that are needed for WebObject.
public:
	std::shared_ptr <WebObject> copy() const override;
	std::string print() const override { // {{{
		size_t length = size();
		std::ostringstream ret;
		std::string sep = "LuaTable{";
		for (size_t i = 1; i <= length; ++i) {
			ret << sep << (*this)[Webloop::WebInt::create(i)]->print();
			sep = ", ";
		}
		ret << "}";
		return ret.str();
	} // }}}

public:

	// WebVector-like interface.
	bool empty() const;
	size_t size() const;
	void push_back(std::shared_ptr <WebObject> item);
	void pop_back();

	// WebMap-like interface.
	std::shared_ptr <WebObject> operator[](std::shared_ptr <WebObject> key) const;
	void insert(std::shared_ptr <WebObject> key, std::shared_ptr <WebObject> v);
	// TODO: iterator over all keys.
}; // }}}

// This class wraps a lua Thread object. It is opaque, but can be passed around by C++.
class LuaThread : public LuaObject { // {{{
	friend class Context;
	friend std::shared_ptr <WebObject> stack_read(lua_State *state, int i);
public:
	static int const object_type = Webloop::make_object_type("LuaR");	// R for Run.

	// Construction.
private:
	LuaThread(lua_State *state) : LuaObject(state, object_type) {}
	static std::shared_ptr <WebObject> create(lua_State *state) { return std::shared_ptr <WebObject> (new LuaThread(state)); }

	// Parts that are needed for WebObject.
public:
	std::shared_ptr <WebObject> copy() const override;
	std::string print() const override { return "LuaThread"; }

}; // }}}
// }}}

// This class is used to run code in lua.
class Thread { // {{{
	Context *m_context;
	std::shared_ptr <Webloop::WebObject> m_value;
	bool m_running;
public:
	Thread(Context *context = nullptr);
	~Thread();
	void set(std::string const &variable, std::shared_ptr <Webloop::WebObject> value);
	Webloop::coroutine run(std::string const &script, bool keep_single = false);
	bool running() const { return m_running; }
	std::shared_ptr <Webloop::WebObject> value() const { return m_value; }
}; // }}}

} // namespace Luau

#endif // include guard

// vim: set foldmethod=marker :
