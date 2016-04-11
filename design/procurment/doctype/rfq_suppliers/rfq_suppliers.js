// Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and Contributors
// License: GNU General Public License v3. See license.txt


frappe.require("assets/design/js/controllers/transaction.js");

cur_frm.email_field = "contact_email";

design.rfq_suppliers.RFQController = design.TransactionController.extend({
	onload: function() {
		this.setup_queries();
		this._super();
	},

	setup_queries: function() {
		var me = this;

		if(this.frm.fields_dict.buying_price_list) {
			this.frm.set_query("buying_price_list", function() {
				return{
					filters: { 'buying': 1 }
				}
			});
		}

		
	},

	refresh: function(doc) {
		this.frm.toggle_display("supplier_name",
			(this.supplier_name && this.frm.doc.supplier_name!==this.frm.doc.supplier));

		this._super();
	},

	supplier: function() {
		var me = this;
		design.utils.get_party_details(this.frm, null, null, function(){me.apply_pricing_rule()});
	},

	supplier_address: function() {
		design.utils.get_address_display(this.frm);
	},

	buying_price_list: function() {
		this.apply_price_list();
	},

	price_list_rate: function(doc, cdt, cdn) {
		var item = frappe.get_doc(cdt, cdn);
		frappe.model.round_floats_in(item, ["price_list_rate", "discount_percentage"]);

		item.rate = flt(item.price_list_rate * (1 - item.discount_percentage / 100.0),
			precision("rate", item));

		this.calculate_taxes_and_totals();
	},

	discount_percentage: function(doc, cdt, cdn) {
		this.price_list_rate(doc, cdt, cdn);
	},

	uom: function(doc, cdt, cdn) {
		var me = this;
		var item = frappe.get_doc(cdt, cdn);
		if(item.item_code && item.uom) {
			return this.frm.call({
				method: "erpnext.stock.get_item_details.get_conversion_factor",
				child: item,
				args: {
					item_code: item.item_code,
					uom: item.uom
				},
				callback: function(r) {
					if(!r.exc) {
						me.conversion_factor(me.frm.doc, cdt, cdn);
					}
				}
			});
		}
	},

	qty: function(doc, cdt, cdn) {
		this._super(doc, cdt, cdn);
		this.conversion_factor(doc, cdt, cdn);
	},

	conversion_factor: function(doc, cdt, cdn) {
		if(frappe.meta.get_docfield(cdt, "stock_qty", cdn)) {
			var item = frappe.get_doc(cdt, cdn);
			frappe.model.round_floats_in(item, ["qty", "conversion_factor"]);
			item.stock_qty = flt(item.qty * item.conversion_factor, precision("stock_qty", item));
			refresh_field("stock_qty", item.name, item.parentfield);
		}
	},

	warehouse: function(doc, cdt, cdn) {
		var item = frappe.get_doc(cdt, cdn);
		if(item.item_code && item.warehouse) {
			return this.frm.call({
				method: "erpnext.stock.get_item_details.get_projected_qty",
				child: item,
				args: {
					item_code: item.item_code,
					warehouse: item.warehouse
				}
			});
		}
	},

	project: function(doc, cdt, cdn) {
		var item = frappe.get_doc(cdt, cdn);
		if(item.project) {
			$.each(this.frm.doc["items"] || [],
				function(i, other_item) {
					if(!other_item.project) {
						other_item.project = item.project;
						refresh_field("project", other_item.name, other_item.parentfield);
					}
				});
		}
	},

	category: function(doc, cdt, cdn) {
		// should be the category field of tax table
		if(cdt != doc.doctype) {
			this.calculate_taxes_and_totals();
		}
	},
	add_deduct_tax: function(doc, cdt, cdn) {
		this.calculate_taxes_and_totals();
	},

	set_from_product_bundle: function() {
		var me = this;
		this.frm.add_custom_button(__("Product Bundle"), function() {
			erpnext.buying.get_items_from_product_bundle(me.frm);
		}, __("Get items from"));
	},
	
	company: function() {
		var me = this;
		if (frappe.meta.get_docfield(this.frm.doctype, "shipping_address") 
			&& !this.frm.doc.shipping_address) {
				erpnext.utils.get_shipping_address(this.frm)
		}

		var company_doc = frappe.get_doc(":Company", me.frm.doc.company);
		me.frm.set_value("letter_head", company_doc.default_letter_head);
	},
	
	shipping_address: function(){
		var me = this;
		
		this.frm.set_query("shipping_address", function(){
			if(me.frm.doc.customer){
				return{
					filters:{
						"customer": me.frm.doc.customer
					}
				}
			}
			else{
				return{
					filters:{
						"is_your_company_address": 1,
						"company": me.frm.doc.company
					}
				}
			}
		});
		
		erpnext.utils.get_address_display(this.frm, "shipping_address", 
			"shipping_address_display", is_your_company_address=true)
	}
});

cur_frm.add_fetch('project', 'cost_center', 'cost_center');

// for backward compatibility: combine new and previous states
$.extend(cur_frm.cscript, new erpnext.buying.SupplierQuotationController({frm: cur_frm}));

cur_frm.cscript.uom = function(doc, cdt, cdn) {
	
}


cur_frm.fields_dict['supplier_address'].get_query = function(doc, cdt, cdn) {
	return {
		filters:{'supplier': doc.supplier}
	}
}

cur_frm.fields_dict['contact_person'].get_query = function(doc, cdt, cdn) {
	return {
		filters:{'supplier': doc.supplier}
	}
}

