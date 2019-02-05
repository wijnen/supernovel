var server;

var Connection = {
	refresh: function(data) {
		var cmd = data[0];
		var shown = data[1];
		var num = data[2];
		var total = data[3];
		var answers = data[4];
		var opts = data[5];
		content.innerHTML = cmd.arg;
		if (cmd.cmd != 'title') {
			content.AddElement('br');
			if (shown) {
				var ol = clear.AddElement('ul');
				for (var i = 0; i < opts.length; ++i) {
					var opt;
					if (cmd.cmd == 'choice' || cmd.cmd == 'choices')
						opt = cmd.option[opts[i]];
					else
						opt = opts[i];
					ol.AddElement('li').AddText(opt + ': ' + answers[opts[i]]);
				}
			}
			else {
				content.AddElement('h1').AddText('Antwoorden gezien: ' + num + ' / ' + total);
			}
		}
	},
};

window.AddEvent('load', function () {
	server = Rpc(Connection, null, connection_lost);
});

function connection_lost() {
	try {
		server = Rpc(Connection, null, connection_lost);
	}
	catch (err) {
	}
}

// vim: set foldmethod=marker foldmarker={,} :
