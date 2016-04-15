// Copyright (c) 2016, bobzz.zone@gmail.com and contributors
// For license information, please see license.txt

frappe.ui.form.on('Call For Bid', {
	refresh: function(frm) {

	}
});
cur_frm.add_fetch("item","item_name","item_name");
cur_frm.add_fetch("item","stock_uom","uom");