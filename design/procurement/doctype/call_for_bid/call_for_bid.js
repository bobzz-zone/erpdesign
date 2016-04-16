// Copyright (c) 2016, bobzz.zone@gmail.com and contributors
// For license information, please see license.txt

frappe.ui.form.on('Call For Bid', {
	refresh: function(frm) {

	}
});
cur_frm.add_fetch("item","item_name","item_name");
cur_frm.add_fetch("item","stock_uom","uom");
cur_frm.add_fetch("item","default_warehouse","warehouse");
cur_frm.cscript.view = function(doc){
	frappe.route_options = {"Supplier Quotation.call_for_bid": doc.name};
	frappe.set_route("List", "Supplier Quotation");
}


cur_frm.cscript.best = function(doc){
		var best="";
		var value=0;
		$.each(doc.supplier,function(i,data){
			if (data.received==1){
				if (value==0){
					value=data.price;
					best=data.quotation;
				}else if (value>data.price){
					value=data.price;
					best=data.quotation;
				}
			}
		});
		/**
		var data = doc.supplier;
		for (var i=0;i<data.length;i++){
			if (data.received==1){
				if (value==0){
					value=data.price;
					best=data.quotation;
				}else if (value>data.price){
					value=data.price;
					best=data.quotation;
				}
			}
		**/
		if (best==""){
			frappe.throw("Data is Incomplete");
		}else{
			frappe.set_route("Form", "Supplier Quotation",best);
		}
		
}