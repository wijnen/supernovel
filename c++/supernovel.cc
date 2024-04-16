#include <webloop.hh>
#include <luau.hh>
#include <userdata.hh>

using namespace Webloop;
class Player;

class PlayerMaker {
public:
	typedef coroutine (PlayerMaker::*Published)(Args args, KwArgs kwargs);
	typedef coroutine (PlayerMaker::*PublishedFallback)(std::string const &target, Args args, KwArgs kwargs);
	std::map <std::string, Published> *published;
	PublishedFallback published_fallback;
protected:
	static std::list <Player> players;
public:
	static coroutine create(PlayerMaker *&target, Userdata <PlayerMaker>::PlayerConnection &player);
	static coroutine started(Userdata <PlayerMaker> *u) {
		// Game is running.
		(void)&u;
		std::cout << "Game is running" << std::endl;
		co_return WN();
	}
};

class Player: public PlayerMaker {
	Userdata <PlayerMaker>::PlayerConnection *connection;
	static std::map <std::string, PlayerMaker::Published> player_published;
public:
	Player(Userdata <PlayerMaker>::PlayerConnection *c): connection(c) {
		std::cout << "Player logged in" << std::endl;
		published = &player_published;
		published_fallback = nullptr;
	}
	void init() {
		std::cout << "Player init" << std::endl;
	}
};
std::list <Player> PlayerMaker::players;
std::map <std::string, PlayerMaker::Published> Player::player_published = {
	//{"get", reinterpret_cast <PlayerMaker::Published>(&Player::get)},
};

coroutine PlayerMaker::create(PlayerMaker *&target, Userdata <PlayerMaker>::PlayerConnection &c) {
	players.emplace_back(&c);
	target = &*--players.end();
	co_return WN();
}

int main(int argc, char **argv) {
	fhs_init(argc, argv);
	auto game_db = WM(
		// Permissions. {{{
		WT("group", WV(
			WV("id", "int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY"),
			WV("name", "text NOT NULL")
		)),
		WT("chapter", WV(
			WV("id", "int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY"),
			WV("name", "text NOT NULL"),
			WV("parent", "int(11) DEFAULT NULL")
		)),
		WT("access", WV(
			WV("groupid", "int(11) NOT NULL"),
			WV("chapter", "int(11) DEFAULT NULL")
		)), // }}}
		// Scripts {{{
		WT("script", WV(
			WV("id", "int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY"),
			WV("name", "text NOT NULL"),
			WV("chapter", "int(11) NOT NULL"),
			WV("script", "longtext NOT NULL")
		)),
		WT("question", WV(
			WV("id", "text NOT NULL"),
			WV("script", "int(11) NOT NULL"),
			WV("type", "varchar(255) NOT NULL"),
			WV("description", "varchar(255) NOT NULL")
		)), // }}}
		// Images {{{
		WT("sprite", WV(
			WV("id", "int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY"),  // Sprite id.
			WV("tag", "text NOT NULL"),       // Sprite tag name.
			WV("name", "text NOT NULL"),      // Sprite display name.
			WV("chapter", "int(11) DEFAULT NULL")    // Chapter id, or NULL for global sprites.
		)),
		WT("image", WV(
			WV("id", "int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY"),
			WV("sprite", "int(11) NOT NULL"), // Sprite id.
			WV("mood", "text NOT NULL"),      // Mood name.
			WV("url", "longtext NOT NULL"),   // Data url.

			// Size of image in screen units.
			WV("width", "float NOT NULL"),
			WV("height", "float NOT NULL"),

			// Location of hotspot in screen units.
			// The origin for the hotspot coordinates is the bottom left corner of the image.
			WV("hotx", "float NOT NULL"),
			WV("hoty", "float NOT NULL")
		)), // }}}
		// Media {{{
		WT("audio", WV(
			WV("id", "int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY"),
			WV("chapter", "int(11) DEFAULT NULL"),
			WV("name", "varchar(255) NOT NULL"),
			WV("url", "longtext NOT NULL"),   // Data url.
			WV("duration", "int(11) NOT NULL")
		)) // }}}
	);

	auto player_config = WM( // {{{
		WT("id", WV( // This table has only one row.
			WV("my_group", "varchar(255) NOT NULL"),
			WV("permissions", "int(5) NOT NULL")     // Change this when changing permission_list (written as one word for easier searching).
		)),
		WT("answer", WV(
			WV("script", "mediumtext NOT NULL"),      // tab-separated list of chapters.
			WV("question", "text NOT NULL"),
			WV("answer", "mediumtext NOT NULL"),
			WV("style", "mediumtext DEFAULT NULL")
		))
	); // }}}

	Userdata <PlayerMaker> userdata(game_db, player_config, {"html-player"}); //, "html-supervisor", "html-author"});

	Loop::get()->run();

	return 0;
}

// vim: set foldmethod=marker :
