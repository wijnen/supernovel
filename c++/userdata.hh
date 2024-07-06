// Userdata helper.
// This file should be included by C++ programs that want to use the userdata system.
// Before including this file, the game name must be #define'd as GAMENAME.

// Includes {{{
#include <webloop.hh>
#include <map>
// }}}

/* Documentation. {{{

At boot time, userdata object is created. This opens an rpc connection to the local userdata.
The connection is userdata.local.rpc. The data access object is userdata.game_data.

* Managed player login:
- Player connects to game. This results in a PlayerConnection object.
- Game lets local userdata create dcid.
- Player receives dcid from game.
- Player is directed to local userdata; it connects to it.
- Player uses dcid to log in to local userdata.
- After login, local userdata informs game by calling setup_connect_player on the game.
- In response, game sets up the Player object.

* External player login:
- Player connects to game. This results in a PlayerConnection object.
- Player receives gcid from game.
- Player connects to external userdata and logs in.
- Player instructs external userdata to contact game, passing gcid.
- External userdata contacts game, passing gcid. This is done on a new connection (which is a UserdataConnection) or over an existing connection, where it will create a new channel by calling setup_connect.
- Player object is set up.

Use case: single
	Game logs in to userdata and uses storage for single user.
	Implemented as multi-user storage which never connects a user.

Use case: remote-only
On login:
	- User must provide userdata url (there may be a default)
	- Connect to userdata
	- Get login url from userdata
	- Let user log in
	- return handle

Use case: local with optional remote
On boot:
	- Game connects to userdata and logs in
On login:
	- User may provide userdata url if allowed; otherwise there muct be a default
	- If userdata is not the default, connect to it
	- Get login url from userdata
	- Let user log in
	- return handle

Interface:
	- call setup() or run() to start server/game.
	- player callback is called whenever a new player logs in.
	- the object that is passed to it can use database commands; it must not include a user parameter.
}}} */

static std::string pstr(void *ptr) {
	std::ostringstream out;
	out << std::hex << (unsigned long)ptr << std::dec;
	return out.str();
}

/* Translations. {{{
def parse_translation(definition): // {{{
	'''Convert a single po file into a dict.
	definition is a str or file.
	Returns the dict.
	'''
	if not isinstance(definition, bytes):
		with open(definition) as f:
			definition = f.read()
	try:
		data = subprocess.run(('msgfmt', '-o', '-', '-'), input = definition, close_fds = True, stdout = subprocess.PIPE).stdout
		assert len(data) > 0
	except:
		print('Warning: translation could not be read', file = sys.stderr)
		traceback.print_exc()
		return None
	terms = gettext.GNUTranslations()
	terms._parse(io.BytesIO(data))
	// Convert catalog to regular dict, just in case it wasn't.
	ret = {k: v for k, v in terms._catalog.items()}
	// Remove info node.
	del ret['']
	return ret
// }}}

def read_translations(path): // {{{
	'''Read all translations at path.
	path must be the name of a directory where *.po files are stored. Each file translates the same strings into a language. The filename is the language code (e.g. nl.po).
	Returns a dict of language code keys with dicts of translations as values.
	'''
	ret = {}
	if not os.path.isdir(path):
		print('no translations at %s: path does not exist or is not a directory' % path)
		return ret
	print('reading translations, path="%s"' % path)
	for po in os.listdir(path):
		filename = os.path.join(path, po)
		lang, ext = os.path.splitext(po)
		if ext != os.extsep + 'po' or lang.startswith('.') or not os.path.isfile(filename):
			continue
		with open(filename, 'rb') as f:
			data = parse_translation(f.read())
		if data is None:
			continue
		ret[lang] = data
		print('read language: %s' % lang)
	return ret
// }}}

def _(template, *args): // {{{
	'''Translate a string into the currenly selected language.
	This function is not used by the module. It is meant to be imported by the game using:
		from userdata import _, N_
	That way, translatable strings can be marked using _('string').'''
	if template in game_strings_python:
		template = game_strings_python[template]
	else:
		print('Warning: translation for "%s" not found in dictionary' % template, file = sys.stderr)
	// Handle template the same as in javascript.
	def replace(match):
		n = int(match.group(1))
		if not 1 <= n <= len(args):
			print('Warning: translation template "%s" references invalid argument %d' % (template, n), file = sys.stderr)
			return b'[%d]' % n
		return args[n - 1]
	return re.sub(rb'\$(\d)', template, replace)
// }}}

def N_(template): // {{{
	'This function is used to mark translatable strings that should not be translated where they are defined.'
	return template
// }}}
// }}} */

// Create cryptogaphically hard to guess token.
std::string create_token() { // {{{
	unsigned const SIZE = 24;
	char buffer[SIZE];
	arc4random_buf(buffer, SIZE);
	return Webloop::b64encode(std::string(buffer, SIZE));
} // }}}

template <class Connection>
class Access { // {{{
	Webloop::RPC <Connection> *socket;
	std::shared_ptr <Webloop::WebInt> channel;
public:
	void debug_socket(std::string const &msg) { WL_log("socket " + msg + " " + std::to_string((long)socket)); }
	void swap(Access <Connection> &other) {
		std::swap(socket, other.socket);
		std::swap(channel, other.channel);
	}
	operator bool() const { return socket != nullptr; }
	Access() : socket(nullptr), channel() {}
	Access(Webloop::RPC <Connection> *obj, int channel) : socket(obj), channel(Webloop::WebInt::create(channel)) {}
	Access(Access <Connection> &&other) : socket(std::move(other.socket)), channel(std::move(other.channel)) {}
	Access <Connection> &operator=(Access <Connection> &&other) { swap(other); return *this; }
	void bgcall(std::string const &command, Webloop::Args args = {}, Webloop::KwArgs kwargs = {}, Webloop::RPC <Connection>::BgReply reply = nullptr) {
		auto realargs = args ? std::dynamic_pointer_cast <Webloop::WebVector> (args->copy()) : Webloop::WebVector::create();
		realargs->insert(0, channel);
		socket->bgcall(command, realargs, kwargs ? kwargs : Webloop::WebMap::create(), reply);
	}
	Webloop::coroutine fgcall(std::string const &command, Webloop::Args args = {}, Webloop::KwArgs kwargs = {}) {
		auto realargs = args ? std::dynamic_pointer_cast <Webloop::WebVector> (args->copy()) : Webloop::WebVector::create();
		realargs->insert(0, channel);
		co_return YieldFrom(socket->fgcall(command, realargs, kwargs));
	}
}; // }}}

// Commandline options. {{{
// Note: these values are only used to override defaults from the config file;
// using these directly will ignore the defaults, so that should nog be done
struct UserdataConfig {
	Webloop::StringOption userdata;
	Webloop::StringOption default_userdata;
	Webloop::BoolOption allow_local;
	Webloop::BoolOption no_allow_other;
	Webloop::BoolOption allow_new_players;
	Webloop::BoolOption userdata_setup;
};
UserdataConfig userdata_config {
	{"userdata", "name of file containing userdata url, login name, game name and password", {}, "userdata.ini"},
	{"default-userdata", "default servers for users to connect to (empty string for locally managed)", {}, ""},
	{"allow-local", "allow locally managed users"},
	{"no-allow-other", "do not allow a non-default userdata server"},
	{"allow-new-players", "allow registering new locally managed users"},
	{"userdata-setup", "set up the userdata configuration and exit"}
};
// }}}

template <class Player>
class Userdata { // {{{
	/* Games need to include this file and create an instance of this class.
	   The instance will:
	   - Connect to a userdata for its own data and data of managed users.
		The connection is local.rpc; the object to access local data is game_data.
	   - start an RPC server for players to log in to. This is called httpd.
	   When players connect, a PlayerConnection object is created.
	 */
public:
	class ConnectionBase { // {{{
	public:
		typedef Webloop::RPC <ConnectionBase>::Published Published;
		typedef Webloop::RPC <ConnectionBase>::PublishedFallback PublishedFallback;
		std::map <std::string, Published> *published;
		PublishedFallback published_fallback;
	}; // }}}
	typedef Webloop::Httpd <Userdata <Player> > ServerType;
	typedef Webloop::Args Args;
	typedef Webloop::KwArgs KwArgs;
	typedef void (Player::*ConnectedCb)();
	typedef void (Player::*DisconnectedCb)();
	class UserdataConnection : public ConnectionBase { // {{{
		friend class Userdata <Player>;
		bool is_gamedata; // True for game's own data connection; false for external player connections.
		Userdata <Player> *userdata;
		Webloop::RPC <UserdataConnection> rpc;

		void gamedata_closed() { // {{{
			STARTFUNC;
			Webloop::Loop *loop = Webloop::Loop::get();
			if (loop->is_running())
				loop->stop();
		} // }}}
		Webloop::coroutine finish_game_login_coroutine() { // {{{
			userdata->setup_server();
			YieldFrom(Player::started(userdata));
		} // }}}
		void finish_game_login(std::shared_ptr <Webloop::WebObject> ret) { // {{{
			// Inform game that connection is active.
			(void)&ret;
			finish_game_login_coroutine()();
		} // }}}
		void game_login_done(std::shared_ptr <Webloop::WebObject> ret) { // {{{
			if (!*ret->as_bool()) {
				std::cerr << "Failed to log in to game userdata server" << std::endl;
				throw "Failed to log in";
			}
			// login done, enable game access.
			userdata->game_data = Access <UserdataConnection> (&rpc, userdata->next_channel++);

			if (userdata->db_config->size() > 0)
				userdata->game_data.bgcall("setup_db", Webloop::WebVector::create(userdata->db_config), nullptr, &UserdataConnection::finish_game_login);
			else
				finish_game_login(Webloop::WebNone::create());
		} // }}}
		void game_error(std::string const &message) { // {{{
			WL_log("Error from game data server: " + message);
			Webloop::Loop::get()->stop();
		} // }}}
		void game_login_failed(std::string const &message) { // {{{
			WL_log("Login to game data failed: " + message);
			Webloop::Loop::get()->stop();
		} // }}}

		typedef void (UserdataConnection::*Reply)(std::shared_ptr <Webloop::WebObject> ret);
		static std::map <std::string, typename ConnectionBase::Published> published_gamedata_funcs;
		static std::map <std::string, typename ConnectionBase::Published> published_funcs;
		// This constructor is used for the local userdata. Almost everything is in a coroutine, so YieldFrom can be used.
		Webloop::coroutine login_local() { // {{{
			YieldFrom(rpc.websocket.wait_for_init());
			rpc.set_disconnect_cb(&UserdataConnection::gamedata_closed);
			rpc.set_error_cb(&UserdataConnection::game_login_failed);
			rpc.bgcall("login_game", Webloop::WebVector::create(
						Webloop::WebInt::create(1),
						Webloop::WebString::create(userdata->usetup.login),
						Webloop::WebString::create(userdata->usetup.game),
						Webloop::WebString::create(userdata->usetup.password),
						Webloop::WebBool::create(userdata->usetup.allow_new_players)
					), {}, &UserdataConnection::game_login_done);
		} // }}}
		UserdataConnection(std::string const &service, Userdata *userdata) : // {{{
				is_gamedata(true),
				userdata(userdata),
				rpc(service, this)
		{
			rpc.websocket.set_name("game userdata");
			this->published = &published_gamedata_funcs;
			this->published_fallback = nullptr;
			// The rest is handled by login_local, which must be called from the actual object (this object is copied and destroyed immediately after creation).
		} // }}}
		UserdataConnection() : is_gamedata(true), userdata(nullptr), rpc() {}	// This is only used when generating userdata configuration; the object is not used in that case.
		UserdataConnection &operator=(UserdataConnection &&other) { // {{{
			this->published = other.published;
			this->published_fallback = other.published_fallback;
			is_gamedata = other.is_gamedata;
			rpc = std::move(other.rpc);
			rpc.update_user(this);
			userdata = other.userdata;
			return *this;
		} // }}}
	public:
		// This constructor is used when a new connection is accepted.
		UserdataConnection(ServerType::Connection &connection, int channel, std::string const &name, std::string const &language, std::string const &gcid) : // {{{
				is_gamedata(false),
				userdata(connection.httpd->owner),
				rpc(connection, this)
		{
			rpc.websocket.set_name("player userdata for " + name + " / " + gcid);
			this->published = &published_funcs;
			this->published_fallback = nullptr;
			// setup_connect_impl handles connecting the userdata to the game.
			// This can also be called by the userdata on an existing connection.
			setup_connect_impl(channel, name, std::string(), language, gcid);
		} // }}}
		~UserdataConnection() { // {{{
			STARTFUNC;
			rpc.disconnect();
		} // }}}

		// Connect local or external player on this userdata connection.
		Webloop::coroutine setup_connect_impl(int new_channel, std::string const &name, std::string const &managed_name, std::string const &language, std::string const &gcid) { // {{{
			/* This call is made by a userdata server,
			   either at the end of the contructor of the
			   connection object (for a new connection by the
			   userdata), or on a connection that is already used
			   as userdata connection for another player. */

			// new_channel is the new id that is to be used by the new connection.
			// name is the external name of the player on the new connection.
			// language is the language preference of the player on the new connection.
			// gcid is the id of the connection that is waiting to be connected to a userdata.

			assert(new_channel != 0);

			// Create new channel.
			YieldFrom(userdata->game_data.fgcall("access_managed_player", Webloop::WebVector::create(Webloop::WebInt::create(new_channel), Webloop::WebString::create(managed_name))));

			auto g = userdata->pending_gcid.find(gcid);
			// Check that the gcid is valid.
			if (g == userdata->pending_gcid.end()) {
				WL_log("invalid gcid in query string");
				throw "invalid gcid";
			}

			// Set up the player connection.
			auto connection = g->second;
			userdata->active_gcid[gcid] = connection;
			userdata->pending_gcid.erase(g);

			// Check and set player id.
			assert(!connection->data);
			connection->data = Access <UserdataConnection>(&rpc, new_channel);

			YieldFrom(connection->setup_player(name, managed_name, language));
			co_return Webloop::WebNone::create();
		} // }}}

		// Parse all WebObject arguments and call setup_connect_impl for external player if they are valid types.
		Webloop::coroutine setup_connect(Args args, KwArgs kwargs) { // {{{
			if (kwargs->size() > 0 ||
					args->size() != 4 ||
					(*args)[0]->get_type() != Webloop::WebObject::INT ||
					(*args)[1]->get_type() != Webloop::WebObject::STRING ||
					(*args)[2]->get_type() != Webloop::WebObject::STRING ||
					(*args)[3]->get_type() != Webloop::WebObject::STRING) {
				WL_log("Invalid arguments for setup_connect");
				co_return Webloop::WebNone::create();
			}
			auto channel = Webloop::WebObject::IntType((*args)[0]->as_int());
			std::string name = *(*args)[1]->as_string();
			std::string language = *(*args)[2]->as_string();
			std::string gcid = *(*args)[3]->as_string();
			co_return YieldFrom(setup_connect_impl(channel, name, std::string(), language, gcid));
		} // }}}

		// Parse all WebObject arguments and call setup_connect_impl for managed player if they are valid types.
		Webloop::coroutine setup_connect_player(std::shared_ptr <Webloop::WebVector> args, std::shared_ptr <Webloop::WebMap> kwargs) { // {{{
			// Report successful login of a managed player.
			if (kwargs->size() > 0 ||
					args->size() != 5 ||
					(*args)[0]->get_type() != Webloop::WebObject::INT ||
					Webloop::WebObject::IntType(*(*args)[0]->as_int()) != 1 ||
					(*args)[1]->get_type() != Webloop::WebObject::STRING ||
					(*args)[2]->get_type() != Webloop::WebObject::STRING ||
					(*args)[3]->get_type() != Webloop::WebObject::STRING ||
					(
						(*args)[4]->get_type() != Webloop::WebObject::NONE &&
						(*args)[4]->get_type() != Webloop::WebObject::STRING
					)
			) {
				WL_log("Invalid arguments for setup_connect: " + args->print());
				co_return Webloop::WebNone::create();
			}
			std::string gcid = *(*args)[1]->as_string();
			std::string managed_name = *(*args)[2]->as_string();
			std::string name = *(*args)[3]->as_string();
			std::string language = (*args)[4]->get_type() == Webloop::WebObject::NONE ? std::string() : std::string(*(*args)[4]->as_string()); // FIXME: Split string and get first supported language from list.
			int new_channel = userdata->next_channel++;
			co_return YieldFrom(setup_connect_impl(new_channel, name, managed_name, language, gcid));
		} // }}}
	}; // }}}
	class PlayerConnection : public ConnectionBase { // {{{
		friend class Userdata <Player>;
		Webloop::RPC <ConnectionBase> rpc;
		Userdata <Player> *userdata;
		unsigned index;	// Which service was connected to.
		std::string gcid;
		std::string dcid;
		std::string name;
		std::string managed_name;
		std::string language;
		Player *player;
		Access <UserdataConnection> data;
	public:
		Userdata <Player> *get_userdata() const { return userdata; }
		unsigned get_index() const { return index; }
		static std::map <std::string, typename ConnectionBase::Published> published_funcs;
		PlayerConnection(std::string const &new_gcid, ServerType::Connection &connection) : // {{{
				rpc(connection, this),
				userdata(connection.httpd->owner),
				index(0),
				gcid(new_gcid),
				dcid(),
				name(),
				managed_name(),
				language(),
				player(nullptr),
				data()
		{
			STARTFUNC;
			WL_log("make player " + pstr(this));
			rpc.websocket.set_name("player " + gcid);
			for (index = 0; index < userdata->usetup.game_port.size(); ++index) {
				if (userdata->usetup.game_port[index] == connection.httpd->service)
					break;
			}
			assert(index < userdata->usetup.game_port.size());
			this->published = &published_funcs;
			this->published_fallback = reinterpret_cast <ConnectionBase::PublishedFallback>(&Userdata <Player>::PlayerConnection::call_player);
			rpc.set_disconnect_cb(reinterpret_cast <Webloop::RPC <ConnectionBase>::DisconnectCb> (&PlayerConnection::closed));
			userdata->game_data.debug_socket("new player");
			WL_log(pstr(this));
			finish_init()();
			WL_log("done making player " + pstr(this));
		} // }}}
		Webloop::coroutine finish_init(bool logged_out = false) { // {{{
			STARTFUNC;
			WL_log(pstr(this));
			// Second stage of constructor. This is a separate function so it can yield.
			// This is called for connections where a player should log in.
			std::string reported_gcid;
			if (!userdata->usetup.no_allow_other)
				reported_gcid = gcid;
			userdata->game_data.debug_socket("finish init");
			if (userdata->usetup.allow_local) {
				auto dcid_obj = YieldFrom(userdata->game_data.fgcall("create_dcid", Webloop::WebVector::create(Webloop::WebString::create(gcid))));
				//WL_log("dcid: " + dcid_obj->print());
				dcid = *dcid_obj->as_string();
			}
			std::shared_ptr <Webloop::WebMap> sent_settings = Webloop::WebMap::create(
				std::make_pair("allow-local", Webloop::WebBool::create(userdata->usetup.allow_local)),
				std::make_pair("allow-other", Webloop::WebBool::create(!userdata->usetup.no_allow_other))
			);
			if (userdata->usetup.allow_local) {
				(*sent_settings)["local-userdata"] = Webloop::WebString::create(userdata->usetup.default_userdata.empty() ? userdata->usetup.data_url : userdata->usetup.default_userdata);
			}
			if (logged_out)
				(*sent_settings)["logout"] = Webloop::WebBool::create(true);
			if (userdata->usetup.allow_new_players)
				(*sent_settings)["allow-new-players"] = Webloop::WebBool::create(true);
			rpc.bgcall("userdata_setup", Webloop::WebVector::create(
						Webloop::WebString::create(Webloop::strip(userdata->usetup.default_userdata)),
						Webloop::WebString::create(userdata->usetup.game_url),
						sent_settings,
						Webloop::WebString::create(reported_gcid),
						Webloop::WebString::create(dcid)));
		} // }}}

		void revoke_links() { // {{{
			if (Webloop::DEBUG > 3) {
				WL_log("revoking links for gcid " + gcid + " and dcid " + dcid);
				WL_log("pending:");
				for (auto &g: userdata->pending_gcid)
					WL_log("\t" + g.first);
				WL_log("active:");
				for (auto &g: userdata->active_gcid)
					WL_log("\t" + g.first);
				WL_log("end of list");
			}
			if (!gcid.empty()) {
				if (name.empty())
					userdata->pending_gcid.erase(gcid);
				else
					userdata->active_gcid.erase(gcid);
				gcid.clear();
			}
			if (!dcid.empty()) {
				if (name.empty()) {
					userdata->game_data.bgcall("drop_pending_dcid", Webloop::WebVector::create(Webloop::WebString::create(dcid)));
				}
				else {
					userdata->game_data.bgcall("drop_active_dcid", Webloop::WebVector::create(Webloop::WebString::create(dcid)));
				}
				dcid.clear();
			}
		} // }}}
		void closed() { // {{{
			revoke_links();
			// This is a player connection.
			if (userdata->players.contains(gcid))
				userdata->players.erase(gcid);
			// Notify userdata that user is lost.
			userdata->disconnect(this);
		} // }}}
		~PlayerConnection() { // {{{
			STARTFUNC;
			WL_log("kill player " + pstr(this));
			rpc.disconnect();
			closed();
		} // }}}

			/*
		def _update_strings(self): // {{{
			self._remote.userdata_translate.event(system_strings[self._language] if self._language in system_strings else None, game_strings_html[self._language] if self._language in game_strings_html else None)
		// }}}
		*/
		Webloop::coroutine setup_player(std::string const &my_name, std::string const &my_managed_name, std::string const &my_language) { // {{{
			// Handle player setup. This is called both for managed and external players.
			name = my_name;
			managed_name = my_managed_name;
			language = my_language;
			assert(player == nullptr);

			// Initialize db
			auto &player_config = userdata->player_config;
			if (player_config->get_type() != Webloop::WebObject::NONE)
				YieldFrom(data.fgcall("setup_db", Webloop::WebVector::create(player_config)));

			// Create user player object and record it in the server.
			try {
				YieldFrom(Player::create(player, *this));
				assert(player != nullptr);	// player must have been initialized.
			}
			catch (...) {
				// Error: close connection.
				WL_log("Unable to set up player settings; disconnecting");
				rpc.disconnect();
				co_return Webloop::WebNone::create();
			}

			//self._update_strings()
			rpc.bgcall("userdata_setup", Webloop::WebVector::create(
					Webloop::WebNone::create(),
					Webloop::WebNone::create(),
					Webloop::WebMap::create(
						std::make_pair("name", Webloop::WebString::create(name)),
						std::make_pair("managed", Webloop::WebString::create(managed_name))
					)
			));

			co_return Webloop::WebNone::create();
		} // }}}
		Webloop::coroutine userdata_logout(Args args, KwArgs kwargs) { // {{{
			(void)&args;
			(void)&kwargs;
			if (Webloop::DEBUG > 4)
				WL_log("logout");
			player = nullptr; // FIXME: close link with userdata as well.
			userdata->game_data.debug_socket("userdata logout");
			YieldFrom(finish_init(true));
		} // }}}

		Webloop::coroutine call_player(std::string const &target, Args args, KwArgs kwargs) { // {{{
			if (!player)
				throw "invalid attribute for anonymous user";
			auto func = player->published->find(target);
			if (func == player->published->end()) {
				if (player->published_fallback == nullptr)
					throw "undefined function";
				co_return YieldFrom((player->*player->published_fallback)(target, args, kwargs));
			}
			co_return YieldFrom((player->*func->second)(args, kwargs));
		} // }}}
	}; // }}}
	struct USetup {	// Userdata setup, read from config file. {{{
		static bool initialized;	// Flag to detect multiple instantiations.
		bool file_exists;
		std::string data_url;
		std::string data_websocket;
		std::string game;
		std::string login;
		std::string password;
		std::string game_url;
		std::vector <std::string> game_port;
		std::string default_userdata;
		bool allow_local;
		bool no_allow_other;
		bool allow_new_players;
		bool parse_bool(std::string const &src) { // {{{
			if (src == "1" || Webloop::lower(src) == "true")
				return true;
			if (src == "0" || Webloop::lower(src) == "false")
				return false;
			WL_log("invalid bool value in userdata configuration: " + src);
			abort();
		} // }}}
		USetup() :
			// Set defaults.
			file_exists(false),
			allow_local(false),
			no_allow_other(false),
			allow_new_players(false)
		{ // {{{
			// Read info from file. This is supposed to happen only once.
			assert(!initialized);
			initialized = true;

			std::ifstream cfg(userdata_config.userdata.value);
			file_exists = cfg.is_open();
			if (!file_exists) {
				// If the configuration is about to be generated, the file does not need to exist.
				if (!userdata_config.userdata_setup.value) {
					WL_log("No userdata configuration found; aborting");
					abort();
				}
			}
			if (file_exists) {
				while (cfg.good()) {
					std::string line;
					std::getline(cfg, line);
					if (!cfg.good())
						break;
					auto stripped = Webloop::strip(line);
					if (stripped.empty() || stripped[0] == '#')
						continue;
					auto kv = Webloop::split(line, 1, 0, "=");
					if (kv.size() != 2) {
						WL_log("ignoring invalid line in userdata config: " + stripped);
						continue;
					}
					for (int i = 0; i < 2; ++i)
						kv[i] = Webloop::strip(kv[i]);
					if (kv[0] == "data-url") data_url = kv[1];
					else if (kv[0] == "data-websocket") data_websocket = kv[1];
					else if (kv[0] == "game") game = kv[1];
					else if (kv[0] == "login") login = kv[1];
					else if (kv[0] == "password") password = kv[1];
					else if (kv[0] == "game-url") game_url = kv[1];
					else if (kv[0] == "game-port") game_port.push_back(kv[1]);
					else if (kv[0] == "default-userdata") default_userdata = kv[1];
					else if (kv[0] == "allow-local") allow_local = parse_bool(kv[1]);
					else if (kv[0] == "no-allow-other") no_allow_other = parse_bool(kv[1]);
					else if (kv[0] == "allow-new-players") allow_new_players = parse_bool(kv[1]);
					else WL_log("ignoring invalid line in userdata config: " + stripped);
				}
				cfg.close();
			}
			// Use commandline overrides.
			if (!userdata_config.default_userdata.is_default)
				default_userdata = userdata_config.default_userdata.value;
			if (!userdata_config.allow_local.is_default)
				allow_local = userdata_config.allow_local.value;
			if (!userdata_config.no_allow_other.is_default)
				no_allow_other = userdata_config.no_allow_other.value;
			if (!userdata_config.allow_new_players.is_default)
				allow_new_players = userdata_config.allow_new_players.value;
			// Compute port from url if it wasn't specified.
			if (game_port.empty()) {
				Webloop::URL url(game_url);
				game_port.push_back(url.service);
			}
			//std::cout << "usetup " << std::hex << (long)this << std::dec << " state: " << file_exists << " " << data_url << " " << data_websocket << " " << game << " " << login << " " << password << " " << game_url << " " << default_userdata << " " << allow_local << " " << no_allow_other << " " << allow_new_players << std::endl;
		} // }}}
		// Do not allow copying.
		USetup(USetup &other) = delete;
		USetup &operator=(USetup &other) = delete;
		USetup(USetup const &other) = delete;
		USetup &operator=(USetup const &other) = delete;
	}; // }}}
	Access <UserdataConnection> game_data;
private:
	USetup usetup;
	std::vector <ServerType> httpd;
	UserdataConnection local;
	std::vector <std::string> html_dirnames;
	Webloop::Loop *loop;
	int backlog;
	std::shared_ptr <Webloop::WebMap> db_config;
	std::shared_ptr <Webloop::WebMap> player_config;
	int next_channel;
	std::list <UserdataConnection> userdatas;
	std::map <std::string, PlayerConnection *> pending_gcid;
	std::map <std::string, PlayerConnection *> active_gcid;
	// Note that players must be defined after *_gcid, because the destruction order is important.
	std::map <std::string, PlayerConnection> players;	// Key is gcid.
	ConnectedCb connected_cb;
	DisconnectedCb disconnected_cb;
	void disconnect(PlayerConnection *connection) { // {{{
		// call closed callback on Player.
		if (disconnected_cb != nullptr)
			((connection->player)->*disconnected_cb)();
	} // }}}
	void accept_websocket(ServerType::Connection &connection) { // {{{
		// A gcid in the query string is used by an external userdata to connect a player.
		auto c = connection.url.query.find("channel");
		auto g = connection.url.query.find("gcid");
		auto n = connection.url.query.find("name");
		if (c == connection.url.query.end() || g == connection.url.query.end() || n == connection.url.query.end()) {
			// No gcid (or no channel, or no name), so this connection is for a player to log in to this game.

			// Create new gcid for this connection.
			auto gcid = create_token();
			while (pending_gcid.contains(gcid) || active_gcid.contains(gcid))
				gcid = create_token();
			connection.socket.set_name("player login " + gcid);

			std::tuple <std::string> key { gcid };
			std::tuple <std::string, typename ServerType::Connection &> args { gcid, connection };
			pending_gcid[gcid] = &players.emplace(std::piecewise_construct, key, args).first->second;
			WL_log(pstr(&players.find(gcid)->second));
			return;
		}

		// A connection with a gcid should be a userdata providing access to this game for a player.

		// Set player from gcid.
		int channel = std::stoi(c->second);
		auto &name = n->second;
		std::string language;	// TODO: get this from header.
		auto &gcid = g->second;
		connection.socket.set_name("userdata for " + name + " / " + gcid);

		userdatas.emplace_back(connection, channel, name, language, gcid);
	} // }}}
	void setup_server() { // {{{
		for (size_t p = 0; p < usetup.game_port.size(); ++p) {
			httpd.emplace_back(this, usetup.game_port[p], html_dirnames[p], loop, backlog);
			httpd.back().set_accept(&Userdata::accept_websocket);
		}
	} // }}}
public:
	void set_connected_cb(ConnectedCb cb) { connected_cb = cb; }
	void set_disconnected_cb(DisconnectedCb cb) { disconnected_cb = cb; }
	Webloop::coroutine generate_userdata_configuration() { // {{{
		std::cout << "Generating userdata configuration in " << userdata_config.userdata.value << std::endl;
		std::string reply;
		Webloop::RPC <ConnectionBase> rpc;
		std::ifstream cfg(userdata_config.userdata.value);
		if (usetup.file_exists) { // Inform user when configuration is updated instead of being created. {{{
			std::cout << "!!! NOTE !!!\nUserdata configuration found, so updating.\nPress enter to continue, or ctrl-c to abort." << std::endl;
			std::getline(std::cin, reply);
		} // }}}

		while (true) {
			// Read data-url. {{{
			if (usetup.data_url.empty())
				usetup.data_url = "http://localhost:8879";
			std::cout << "Enter URL of userdata for players to connect to. Default: " << usetup.data_url << std::endl;
			std::getline(std::cin, reply);
			reply = Webloop::strip(reply);
			if (!reply.empty())
				usetup.data_url = std::move(reply);
			// }}}

			// Read data-websocket. {{{
			if (usetup.data_websocket.empty())
				usetup.data_websocket = usetup.data_url + "/websocket";
			std::cout << "Enter URL of userdata websocket for game to connect to. Default: " << usetup.data_websocket << std::endl;
			std::getline(std::cin, reply);
			reply = Webloop::strip(reply);
			if (!reply.empty())
				usetup.data_websocket = std::move(reply);
			// }}}

			// Open connection to userdata. {{{
			try {
				rpc = Webloop::RPC <ConnectionBase> (usetup.data_websocket);
				YieldFrom(rpc.websocket.wait_for_init());
			}
			catch(std::string msg) {
				std::cerr << "Unable to connect to userdata websocket. Please try again: " << msg << std::endl;
				continue;
			}
			catch(char const *msg) {
				std::cerr << "Unable to connect to userdata websocket. Please try again: " << msg << std::endl;
				continue;
			} // }}}

			// Everything worked; go to next step.
			break;
		}

		while (true) { // Read master login credentials. {{{
			std::cout << "Enter login name on userdata. Default: " << usetup.login << std::endl;
			std::getline(std::cin, reply);
			reply = Webloop::strip(reply);
			if (!reply.empty())
				usetup.login = std::move(reply);

			std::cout << "Enter user password for managing account data." << std::endl;
			std::getline(std::cin, reply);
			reply = Webloop::strip(reply);
			auto ret = YieldFrom(rpc.fgcall("login_user", Webloop::WV(1, usetup.login, reply)));
			if (*ret->as_bool())
				break;
			std::cout << "Login to userdata failed." << std::endl;
		} // }}}

		std::shared_ptr <Webloop::WebObject> games_obj = YieldFrom(rpc.fgcall("list_games", Webloop::WV(1)));
		auto games = games_obj->as_vector();

		while (true) { // Update or create game on userdata. {{{
			// List existing games on userdata. {{{
			if (games->size() == 0) {
				std::cout << "No existing games." << std::endl;
			}
			else {
				std::cout << "Existing games:" << std::endl;
				for (size_t i = 0; i < games->size(); ++i) {
					auto g = (*games)[i]->as_map();
					std::cout << std::string(*(*g)["name"]->as_string()) << ": " << std::string(*(*g)["fullname"]->as_string()) << std::endl;
				}
			} // }}}

			// Short game name. {{{
			std::cout << "Enter (short) name of the game. Default: " << usetup.game << std::endl;
			std::getline(std::cin, reply);
			reply = Webloop::strip(reply);
			if (!reply.empty())
				usetup.game = std::move(reply);
			if (usetup.game.empty()) {
				std::cerr << "Empty game name is not allowed." << std::endl;
				continue;
			}

			size_t i;
			std::string fullname;
			for (i = 0; i < games->size(); ++i) {
				auto g = (*games)[i]->as_map();
				if (usetup.game == std::string(*(*g)["name"]->as_string())) {
					std::cout << "Using existing game." << std::endl;
					fullname = std::string(*(*g)["fullname"]->as_string());
					break;
				}
			}
			if (i >= games->size())
				std::cout << "Creating new game." << std::endl;
			// }}}

			// Game password. {{{
			if (usetup.password.empty())
				std::cout << "Enter game password. Leave empty to generate new." << std::endl;
			else
				std::cout << "Enter game password. Default: " << usetup.password << std::endl;
			std::getline(std::cin, reply);
			reply = Webloop::strip(reply);
			if (!reply.empty())
				usetup.password = reply;
			if (usetup.password.empty())
				usetup.password = create_token();
			// }}}

			// Full game name. {{{
			if (fullname.empty()) {
				std::cout << "Enter new full game name." << std::endl;
				std::getline(std::cin, reply);
				fullname = Webloop::strip(reply);
			}
			else {
				std::cout << "Enter new full game name. Default: " << fullname << std::endl;
				std::getline(std::cin, reply);
				if (!reply.empty())
					fullname = Webloop::strip(reply);
			}
			// }}}

			if (i < games->size()) {
				// Update existing game. {{{
				std::cout << "Enter new (short) game name. Leave empty to keep old name." << std::endl;
				std::getline(std::cin, reply);
				reply = Webloop::strip(reply);
				if (reply.empty())
					reply = usetup.game;
				YieldFrom(rpc.fgcall("update_game", Webloop::WV(1, usetup.game, reply, fullname, usetup.password)));
				usetup.game = reply;
				// }}}
			}
			else {
				// Create new game. {{{
				YieldFrom(rpc.fgcall("add_game", Webloop::WV(1, usetup.game, fullname, usetup.password)));
				// }}}
			}
			break;
		} // }}}

		// Game-url (for letting an external userdata connect to the game. {{{
		std::cout << "Enter URL at which a userdata can connect to the game. Default: " << usetup.game_url << std::endl;
		std::getline(std::cin, reply);
		reply = Webloop::strip(reply);
		if (!reply.empty())
			usetup.game_url = reply;
		// }}}

		// Game ports {{{
		std::cout << "Enter ports at which the game must listen for connections, separated by comma's. Default: ";
		std::string sep = "";
		for (auto p: usetup.game_port) {
			std::cout << sep << p;
			sep = ",";
		}
		std::cout << std::endl;
		std::getline(std::cin, reply);
		reply = Webloop::strip(reply);
		if (!reply.empty()) {
			usetup.game_port.clear();
			auto ports = Webloop::split(reply, -1, 0, ",");
			for (auto p: ports)
				usetup.game_port.push_back(Webloop::strip(p));
		}
		// }}}

		// Default userdata. {{{
		std::cout << "Enter URL of default userdata. Use '-' for local userdata. Default: " << (usetup.default_userdata.empty() ? "-" : usetup.default_userdata) << std::endl;
		std::getline(std::cin, reply);
		reply = Webloop::strip(reply);
		if (!reply.empty())
			usetup.default_userdata = reply;
		if (usetup.default_userdata == "-")
			usetup.default_userdata = "";
		// }}}

		// Allow-local {{{
		if (usetup.default_userdata.empty())
			usetup.allow_local = true;
		else while (true) {
			std::cout << "Should locally managed data be allowed? [yn] Default: " << (usetup.allow_local ? "y" : "n") << std::endl;
			std::getline(std::cin, reply);
			reply = Webloop::strip(reply);
			if (!reply.empty()) {
				if (reply == "y")
					usetup.allow_local = true;
				else if (reply == "n")
					usetup.allow_local = false;
				else
					continue;
			}
			break;
		} // }}}

		// Allow-new-players {{{
		if (usetup.allow_local) {
			while (true) {
				std::cout << "Should creating new local accounts be allowed? [yn] Default: " << (usetup.allow_new_players ? "y" : "n") << std::endl;
				std::getline(std::cin, reply);
				reply = Webloop::strip(reply);
				if (!reply.empty()) {
					if (reply == "y")
						usetup.allow_new_players = true;
					else if (reply == "n")
						usetup.allow_new_players = false;
					else
						continue;
				}
				break;
			}
		}
		else
			usetup.allow_new_players = false;
		// }}}

		// Allow external. {{{
		while (true) {
			std::cout << "Should externally managed data be allowed? [yn] Default: " << (usetup.no_allow_other ? "n" : "y") << std::endl;
			std::getline(std::cin, reply);
			reply = Webloop::strip(reply);
			if (!reply.empty()) {
				if (reply == "y")
					usetup.no_allow_other = false;
				else if (reply == "n")
					usetup.no_allow_other = true;
				else
					continue;
			}
			break;
		} // }}}

		// Setup complete; write results to config file. {{{
		std::ofstream outfile(userdata_config.userdata.value);
		outfile << "data-url = " << usetup.data_url << std::endl;
		outfile << "data-websocket = " << usetup.data_websocket << std::endl;
		outfile << "game = " << usetup.game << std::endl;
		outfile << "login = " << usetup.login << std::endl;
		outfile << "password = " << usetup.password << std::endl;
		outfile << "game-url = " << usetup.game_url << std::endl;
		for (auto p: usetup.game_port)
			outfile << "game-port = " << p << std::endl;
		outfile << "default-userdata = " << usetup.default_userdata << std::endl;
		outfile << "allow-local = " << (usetup.allow_local ? "true" : "false") << std::endl;
		outfile << "no-allow-other = " << (usetup.no_allow_other ? "true" : "false") << std::endl;
		outfile << "allow-new-players = " << (usetup.allow_new_players ? "true" : "false") << std::endl;
		// }}}

		exit(0);
	} // }}}
	Userdata( // {{{
			std::shared_ptr <Webloop::WebMap> db_config,
			std::shared_ptr <Webloop::WebMap> player_config,
			std::vector <std::string> const &html_dirnames = {"html"},
			Webloop::Loop *loop = nullptr,
			int backlog = 5
	) :
			usetup(),
			httpd(),
			local(),
			html_dirnames(html_dirnames),
			loop(loop),
			backlog(backlog),
			db_config(db_config),
			player_config(player_config),
			next_channel(1),
			userdatas(),
			pending_gcid(),
			active_gcid(),
			players(),
			connected_cb(),
			disconnected_cb()
	{
		if (userdata_config.userdata_setup.value) {
			// Request for generating userdata config file. Do that and exit.
			generate_userdata_configuration()();
			return;
		}

		assert(usetup.game_port.size() == html_dirnames.size());	// There must be exactly as many listening ports as html directories.
		assert(!Webloop::strip(usetup.default_userdata).empty() || usetup.allow_local);	// If default is "", allow-local must be true.

		/* Read translations. TODO {{{
		global system_strings, game_strings_html, game_strings_python
		// System translations.
		langfiles = importlib.resources.files(__package__).joinpath('lang')
		print('lang', langfiles)
		system_strings = {}
		pofiles = []
		for lang in langfiles.iterdir():
			if not lang.name.endswith(os.extsep + 'po'):
				continue
			print('parsing stings for "%s"' % lang)
			system_strings[os.path.splitext(os.path.basename(lang))[0]] = parse_translation(lang.read_bytes())

		// Game translations.
		dirs = fhs.read_data('lang', dir = True, multiple = True, opened = False)
		game_strings_html = {}
		game_strings_python = {}
		for d in dirs:
			s = read_translations(os.path.join(d, 'html'))
			game_strings_html.update(s)
			s = read_translations(os.path.join(d, 'python'))
			game_strings_python.update(s)
		// }}} */

		local = UserdataConnection(usetup.data_websocket, this);
		// Call the coroutine that handles the login.
		local.login_local()();
	} // }}}
}; // }}}

// Static published functions. {{{
// Published functions for player connection: userdata_logout() (FIXME: This should not be called through the game, but directly to the userdata.).
template <class Player> std::map <std::string, typename Userdata <Player>::ConnectionBase::Published> Userdata <Player>::PlayerConnection::published_funcs = {
	{"userdata_logout", reinterpret_cast <Userdata <Player>::ConnectionBase::Published>(&Userdata <Player>::PlayerConnection::userdata_logout)}
};
// Published functions for local userdata connection: setup_connect_player()
template <class Player> std::map <std::string, typename Userdata <Player>::ConnectionBase::Published> Userdata <Player>::UserdataConnection::published_gamedata_funcs = {
	{"setup_connect_player", reinterpret_cast <Userdata <Player>::ConnectionBase::Published>(&Userdata <Player>::UserdataConnection::setup_connect_player)}
};

// Published functions for userdata connection: setup_connect().
template <class Player> std::map <std::string, typename Userdata <Player>::ConnectionBase::Published> Userdata <Player>::UserdataConnection::published_funcs = {
	{"setup_connect", reinterpret_cast <Userdata <Player>::ConnectionBase::Published>(&Userdata <Player>::UserdataConnection::setup_connect)}
};

template <class Player> bool Userdata <Player>::USetup::initialized = false;

// vim: set foldmethod=marker :
