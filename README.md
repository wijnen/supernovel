# Purpose
Supernovel is a visual novel engine for use in a school setting.

# Features

  - Basic visual novel features: backgrounds, characters, speech, animated movement, sound effects, music
  - Advanced control logic: everything can be controlled using Python.
  - Teacher login allows reviewing the answers from all players.
  - Players are sorted into groups which have their own games.
  - Sandbox allows players to create their own games.

# Requirements
To install Supernovel, you need a computer that runs GNU/Linux. The system is
web based, which means that the players only need a web browser and there are
no limitations on their platform.

# Installation
If your system is Debian-based, you will want to download the script I use for
building packages from [here](https://people.debian.org/~wijnen/mkdeb).

You will need to clone the following repositories (and Supernovel itself):

  - [https://github.com/wijnen/python-fhs](https://github.com/wijnen/python-fhs)
  - [https://github.com/wijnen/python-network](https://github.com/wijnen/python-network)
  - [https://github.com/wijnen/python-websocketd](https://github.com/wijnen/python-websocketd)

If you downloaded mkdeb, run it in each of those directories to create the
packages. Then run dpkg -i /tmp/\*.deb to install them. Otherwise, just copy or
link the python files (fhs.py, network.py, websocketd.py) to the Supernovel
directory.

The files rpc.js and builders.js from the websocketd package need to be copied
(or linked) into the main html directory. If you installed the package, you should
make symlinks to the installed versions in /usr/share/python3-websocketd/. They
need to go in html/code/.

If you want to use the sandbox, or run untrusted scripts, you should use the
safe system. For this, you will need to set up a chroot in the directory
*chroot* and have firejail installed. The *worker* script needs to be copied
(not symlinked) to the root directory of the chroot.

Create a directory named *users*. In there, create a directory named *admin*
and one named *test*. The latter directory is the first group you will use. It
can have any name, but may not contain uppercase characters.

In *test/*, create a file *user*. Don't put anything in it, it only needs to be
created. Similar to *test*, *user* may have any name, but it must not contain
uppercase characters.

Also in *test/*, create a directory named *Content* (note the uppercase C). In
this directory, create a directory named *Chapter*. This can also have any name
(including uppercase letters) and is shown to the player as a chapter which
contains games. The chapters will be shown in alphabetical order, so you may
want to enumerate them (*1. Chapter Name*) so their sorting order will make
sense.

In this *Chapter* directory you will later place your game scripts. Those are
also sorted alphabetically.

Make a virtual environment for Python 3 named *.env*

```python3 -m venv .env```

Activate the virtual environment (Do this every time before you start the servers)

(for bash+zsh) ```source .env/bin/activate```

(for powershell) ```.\.env\Scripts\Activate.ps1```

(for CMD) ```.\.env\Scripts\activate.bat```

Install the dependencies

```pip install -r requirements.txt```


From the top level directory of the Supernovel source tree, run ```python3 supernovel```.
This should start the system and tell you that servers are running.

Using a browser from the same computer, go to http://localhost:7000 and log in
with the name and group that you just created (*user* and *test* if you
followed this document). Capitals are allowed. Any password is accepted. A hash
of the given password is stored in the user file that you created. (To reset a
user's password, simply remove the line with the password hash from the user
file. After that, any password will be accepted and the new password hash will
be stored in the file.)

Check that the password is in there, then copy the file to the *admin*
directory. This gives your user access to the admin interface.

The *admin* group cannot be used when logging in on the normal interface.
Instead, they log in on http://localhost:7001 .  From there, they can monitor
the players.

## Integration with the machine's main web site
It is recommended to use Apache as a web server. Apache can be set up to act as
a virtual proxy to tunnel the websocket from Supernovel. All other files can be
hosted directly by Apache. Using this system also allows Apache to use an
encrypted connection. This is recommended, because there are passwords sent
over the connection.

# Creating content
Game scripts are placed in *users/[group]/Content/[chapter]/[game].script*
(words in brackets can be chosen by the admin). The format is described in the
documentation under *doc/*.

Required files (graphics and sounds) must be made available to the web browser,
which means they must be installed under *html/*. Keep in mind that anything
under there is accessible to all browsers.

Files which are common to all games are stored in *html/content/common/*. Files
which are specific to one game are stored in
*html/content/[group]/[chapter]/[game]/*.

Backgrounds are stored directly in those directories. Sprites are in a
subdirectory. For example, if *Anja* has a *default.svg* and a *side.svg*
image, those are stored in *Anja/default.svg* and *Anja/side.svg* respectively.

# Using the sandbox
Note: unless you have set up a chroot, users of the sandbox can take full
control of your computer. Don't give untrusted users access to the sandbox
unless you set up the chroot.

The sandbox can be used as an interface to create new games to be published as
regular games later, or to play and try things out. To use it, a user needs
explicit permission. This is given by editing the user file while the user is
not logged in (otherwise it is overwritten when the file is saved). There is a
line in there that says *sandbox=False*. This needs to be changed to
*sandbox=True*.

The sandbox can be accessed at http://localhost:7002 and the credentials that
work for the normal game also work here. (Also admins cannot log in here.) The
sandbox allows uploading of graphics and script files, editing the script files
using a simple textarea widget, and playing the games.

The files are stored under sandbox\_html and can be copied to the main content
directories to publish them.

# Note for Windows users
While Supernovel has been tested and can run on Windows, some features don't
work. In particular:

  - Crypt has been reported to not work. If it fails to import, as a fallback passwords will be stored in plain text. This is a very bad idea, but doing this will allow the program to run.

It is strongly recommended not to use Windows for anything other than personal
use, i.e. testing. If users are accessing your program, they should expect a
secure system and on Windows this is not provided. Please don't do this to
them.

# Feedback
Questions, suggestions, praise or any other feedback is welcome at
[wijnen@debian.org](mailto:wijnen@debian.org). Bugs should be reported in the
issue tracker on github.
