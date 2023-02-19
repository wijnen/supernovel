var server;

function init() {
	server = Rpc(Connection, onopen, onclose);
}
window.AddEvent('load', init);

function onopen() {
	document.body.AddClass('open');
}

function onclose() {
	document.body.RemoveClass('open');
}

var Connection = {
	userdata_setup: userdata_setup,
	scripts: function(scripts) {
		console.info(scripts);
		var select = document.getElementById('script');
		for (var s = 0; s < scripts.length; ++s) {
			var option = select.AddElement('option').AddText(scripts[s].join('/'));
			option.script = scripts[s];
		}
		select.AddEvent('change', function() {
			var o = select.options[select.selectedIndex];
			server.call('select_script', [o.script]);
		});
	},
	script: function(questions, students) {
		console.info(questions, students);
	}
};
