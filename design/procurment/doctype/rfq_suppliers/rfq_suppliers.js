// Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and Contributors
// License: GNU General Public License v3. See license.txt



cur_frm.email_field = "contact_email";

RFQSuppliers=frappe.ui.form.Controller.extend({

	onload_post_render: function() {
		var me = this;
		if(this.frm.doc.__islocal && !(this.frm.doc.taxes || []).length
			&& !(this.frm.doc.__onload ? this.frm.doc.__onload.load_after_mapping : false)) {
				this.apply_default_taxes();
		} else if(this.frm.doc.__islocal && this.frm.doc.company && this.frm.doc["items"]
			&& !this.frm.doc.is_pos) {
				me.calculate_taxes_and_totals();
		}
		if(frappe.meta.get_docfield(this.frm.doc.doctype + " Item", "item_code")) {
			cur_frm.get_field("items").grid.set_multiple_add("item_code", "qty");
		}
	},

	refresh: function() {
		toggle_naming_series();
		hide_company();
		this.show_item_wise_taxes();
		this.set_dynamic_labels();
		pos.make_pos_btn(this.frm);
		this.make_show_payments_btn();
	},

	apply_default_taxes: function() {
		var me = this;
		var taxes_and_charges_field = frappe.meta.get_docfield(me.frm.doc.doctype, "taxes_and_charges",
			me.frm.doc.name);

		if(taxes_and_charges_field) {
			return frappe.call({
				method: "controllers.accounts_controller.get_default_taxes_and_charges",
				args: {
					"master_doctype": taxes_and_charges_field.options
				},
				callback: function(r) {
					if(!r.exc) {
						me.frm.set_value("taxes", r.message);
						me.calculate_taxes_and_totals();
					}
				}
			});
		}
	},


	make_show_payments_btn: function() {
		var me = this;
		if (in_list(["Purchase Invoice", "Sales Invoice"], this.frm.doctype)) {
			if(this.frm.doc.outstanding_amount !== this.frm.doc.base_grand_total) {
				this.frm.add_custom_button(__("Payments"), function() {
					frappe.route_options = {
						"Journal Entry Account.reference_type": me.frm.doc.doctype,
						"Journal Entry Account.reference_name": me.frm.doc.name
					};

					frappe.set_route("List", "Journal Entry");
				}, __("View"));
			}
		}
	},

	barcode: function(doc, cdt, cdn) {
		var d = locals[cdt][cdn];
		if(d.barcode=="" || d.barcode==null) {
			// barcode cleared, remove item
			d.item_code = "";
		}
		this.item_code(doc, cdt, cdn);
	},

	item_code: function(doc, cdt, cdn) {
		var me = this;
		var item = frappe.get_doc(cdt, cdn);
		if(item.item_code || item.barcode || item.serial_no) {
			if(!this.validate_company_and_party()) {
				cur_frm.fields_dict["items"].grid.grid_rows[item.idx - 1].remove();
			} else {
				return this.frm.call({
					method: "stock.get_item_details.get_item_details",
					child: item,
					args: {
						args: {
							item_code: item.item_code,
							barcode: item.barcode,
							serial_no: item.serial_no,
							warehouse: item.warehouse,
							customer: me.frm.doc.customer,
							supplier: me.frm.doc.supplier,
							currency: me.frm.doc.currency,
							conversion_rate: me.frm.doc.conversion_rate,
							price_list: me.frm.doc.selling_price_list ||
								 me.frm.doc.buying_price_list,
							price_list_currency: me.frm.doc.price_list_currency,
							plc_conversion_rate: me.frm.doc.plc_conversion_rate,
							company: me.frm.doc.company,
							order_type: me.frm.doc.order_type,
							is_pos: cint(me.frm.doc.is_pos),
							is_subcontracted: me.frm.doc.is_subcontracted,
							transaction_date: me.frm.doc.transaction_date || me.frm.doc.posting_date,
							ignore_pricing_rule: me.frm.doc.ignore_pricing_rule,
							doctype: me.frm.doc.doctype,
							name: me.frm.doc.name,
							project: item.project || me.frm.doc.project,
							qty: item.qty
						}
					},

					callback: function(r) {
						if(!r.exc) {
							me.frm.script_manager.trigger("price_list_rate", cdt, cdn);
						}
					}
				});
			}
		}
	},

	serial_no: function(doc, cdt, cdn) {
		var me = this;
		var item = frappe.get_doc(cdt, cdn);

		if (item.serial_no) {
			if (!item.item_code) {
				this.frm.script_manager.trigger("item_code", cdt, cdn);
			}
			else {
				var sr_no = [];

				// Replacing all occurences of comma with carriage return
				var serial_nos = item.serial_no.trim().replace(/,/g, '\n');

				serial_nos = serial_nos.trim().split('\n');

				// Trim each string and push unique string to new list
				for (var x=0; x<=serial_nos.length - 1; x++) {
					if (serial_nos[x].trim() != "" && sr_no.indexOf(serial_nos[x].trim()) == -1) {
						sr_no.push(serial_nos[x].trim());
					}
				}

				// Add the new list to the serial no. field in grid with each in new line
				item.serial_no = "";
				for (var x=0; x<=sr_no.length - 1; x++)
					item.serial_no += sr_no[x] + '\n';

				refresh_field("serial_no", item.name, item.parentfield);
				if(!doc.is_return) {
					frappe.model.set_value(item.doctype, item.name, "qty", sr_no.length);
				}
			}
		}
	},

	validate: function() {
		this.calculate_taxes_and_totals(false);
	},

	company: function() {
		var me = this;
		var set_pricing = function() {
			if(me.frm.doc.company && me.frm.fields_dict.currency) {
				var company_currency = me.get_company_currency();
				var company_doc = frappe.get_doc(":Company", me.frm.doc.company);
				if (!me.frm.doc.currency) {
					me.frm.set_value("currency", company_currency);
				}

				if (me.frm.doc.currency == company_currency) {
					me.frm.set_value("conversion_rate", 1.0);
				}
				if (me.frm.doc.price_list_currency == company_currency) {
					me.frm.set_value('plc_conversion_rate', 1.0);
				}
				if (company_doc.default_letter_head) {
					if(me.frm.fields_dict.letter_head) {
						me.frm.set_value("letter_head", company_doc.default_letter_head);
					}
				}
				if (company_doc.default_terms && me.frm.doc.doctype != "Purchase Invoice") {
					me.frm.set_value("tc_name", company_doc.default_terms);
				}

				me.frm.script_manager.trigger("currency");
				me.apply_pricing_rule();
			}
		}

		var set_party_account = function(set_pricing) {
			if (in_list(["Sales Invoice", "Purchase Invoice"], me.frm.doc.doctype)) {
				if(me.frm.doc.doctype=="Sales Invoice") {
					var party_type = "Customer";
					var party_account_field = 'debit_to';
				} else {
					var party_type = "Supplier";
					var party_account_field = 'credit_to';
				}

				var party = me.frm.doc[frappe.model.scrub(party_type)];
				if(party) {
					return frappe.call({
						method: "accounts.party.get_party_account",
						args: {
							company: me.frm.doc.company,
							party_type: party_type,
							party: party
						},
						callback: function(r) {
							if(!r.exc && r.message) {
								me.frm.set_value(party_account_field, r.message);
								set_pricing();
							}
						}
					});
				} else {
					set_pricing();
				}
			} else {
				set_pricing();
			}

		}

		if (this.frm.doc.posting_date) var date = this.frm.doc.posting_date;
		else var date = this.frm.doc.transaction_date;
		set_party_account(set_pricing);

		if(this.frm.doc.company) {
			last_selected_company = this.frm.doc.company;
		}
	},

	transaction_date: function() {
		if (this.frm.doc.transaction_date) {
			this.frm.transaction_date = this.frm.doc.transaction_date;
		}
	},

	posting_date: function() {
		var me = this;
		if (this.frm.doc.posting_date) {
			this.frm.posting_date = this.frm.doc.posting_date;

			if ((this.frm.doc.doctype == "Sales Invoice" && this.frm.doc.customer) ||
				(this.frm.doc.doctype == "Purchase Invoice" && this.frm.doc.supplier)) {
				return frappe.call({
					method: "accounts.party.get_due_date",
					args: {
						"posting_date": me.frm.doc.posting_date,
						"party_type": me.frm.doc.doctype == "Sales Invoice" ? "Customer" : "Supplier",
						"party": me.frm.doc.doctype == "Sales Invoice" ? me.frm.doc.customer : me.frm.doc.supplier,
						"company": me.frm.doc.company
					},
					callback: function(r, rt) {
						if(r.message) {
							me.frm.set_value("due_date", r.message);
						}
					}
				})
			}
		}
	},

	get_company_currency: function() {
		return this.get_currency(this.frm.doc.company);
	},

	contact_person: function() {
		get_contact_details(this.frm);
	},

	currency: function() {
		var me = this;
		this.set_dynamic_labels();

		var company_currency = this.get_company_currency();
		// Added `ignore_pricing_rule` to determine if document is loading after mapping from another doc
		if(this.frm.doc.currency !== company_currency && !this.frm.doc.ignore_pricing_rule) {
			this.get_exchange_rate(this.frm.doc.currency, company_currency,
				function(exchange_rate) {
					me.frm.set_value("conversion_rate", exchange_rate);
				});
		} else {
			this.conversion_rate();
		}
	},

	conversion_rate: function() {
		if(this.frm.doc.currency === this.get_company_currency()) {
			this.frm.set_value("conversion_rate", 1.0);
		}
		if(this.frm.doc.currency === this.frm.doc.price_list_currency &&
			this.frm.doc.plc_conversion_rate !== this.frm.doc.conversion_rate) {
				this.frm.set_value("plc_conversion_rate", this.frm.doc.conversion_rate);
		}

		if(flt(this.frm.doc.conversion_rate)>0.0) {
			if(this.frm.doc.ignore_pricing_rule) {
				this.calculate_taxes_and_totals();
			} else if (!this.in_apply_price_list){
				this.apply_price_list();
			}

		}
	},

	get_exchange_rate: function(from_currency, to_currency, callback) {
		return frappe.call({
			method: "setup.utils.get_exchange_rate",
			args: {
				from_currency: from_currency,
				to_currency: to_currency
			},
			callback: function(r) {
				callback(flt(r.message));
			}
		});
	},

	price_list_currency: function() {
		var me=this;
		this.set_dynamic_labels();

		var company_currency = this.get_company_currency();
		// Added `ignore_pricing_rule` to determine if document is loading after mapping from another doc
		if(this.frm.doc.price_list_currency !== company_currency  && !this.frm.doc.ignore_pricing_rule) {
			this.get_exchange_rate(this.frm.doc.price_list_currency, company_currency,
				function(exchange_rate) {
					me.frm.set_value("plc_conversion_rate", exchange_rate);
				});
		} else {
			this.plc_conversion_rate();
		}
	},

	plc_conversion_rate: function() {
		if(this.frm.doc.price_list_currency === this.get_company_currency()) {
			this.frm.set_value("plc_conversion_rate", 1.0);
		} else if(this.frm.doc.price_list_currency === this.frm.doc.currency
			&& this.frm.doc.plc_conversion_rate && cint(this.frm.doc.plc_conversion_rate) != 1 &&
			cint(this.frm.doc.plc_conversion_rate) != cint(this.frm.doc.conversion_rate)) {
				this.frm.set_value("conversion_rate", this.frm.doc.plc_conversion_rate);
		}

		if(!this.in_apply_price_list) {
			this.apply_price_list();
		}
	},

	qty: function(doc, cdt, cdn) {
		this.apply_pricing_rule(frappe.get_doc(cdt, cdn), true);
	},

	set_dynamic_labels: function() {
		// What TODO? should we make price list system non-mandatory?
		this.frm.toggle_reqd("plc_conversion_rate",
			!!(this.frm.doc.price_list_name && this.frm.doc.price_list_currency));

		var company_currency = this.get_company_currency();
		this.change_form_labels(company_currency);
		this.change_grid_labels(company_currency);
		this.frm.refresh_fields();
	},

	change_form_labels: function(company_currency) {
		var me = this;
		var field_label_map = {};

		var setup_field_label_map = function(fields_list, currency) {
			$.each(fields_list, function(i, fname) {
				var docfield = frappe.meta.docfield_map[me.frm.doc.doctype][fname];
				if(docfield) {
					var label = __(docfield.label || "").replace(/\([^\)]*\)/g, "");
					field_label_map[fname] = label.trim() + " (" + currency + ")";
				}
			});
		};
		setup_field_label_map(["base_total", "base_net_total", "base_total_taxes_and_charges",
			"base_discount_amount", "base_grand_total", "base_rounded_total", "base_in_words",
			"base_taxes_and_charges_added", "base_taxes_and_charges_deducted", "total_amount_to_pay",
			"base_paid_amount", "base_write_off_amount"
		], company_currency);

		setup_field_label_map(["total", "net_total", "total_taxes_and_charges", "discount_amount",
			"grand_total", "taxes_and_charges_added", "taxes_and_charges_deducted",
			"rounded_total", "in_words", "paid_amount", "write_off_amount"], this.frm.doc.currency);

		setup_field_label_map(["outstanding_amount", "total_advance"], this.frm.doc.party_account_currency);

		cur_frm.set_df_property("conversion_rate", "description", "1 " + this.frm.doc.currency
			+ " = [?] " + company_currency)

		if(this.frm.doc.price_list_currency && this.frm.doc.price_list_currency!=company_currency) {
			cur_frm.set_df_property("plc_conversion_rate", "description", "1 " + this.frm.doc.price_list_currency
				+ " = [?] " + company_currency)
		}

		// toggle fields
		this.frm.toggle_display(["conversion_rate", "base_total", "base_net_total", "base_total_taxes_and_charges",
			"base_taxes_and_charges_added", "base_taxes_and_charges_deducted",
			"base_grand_total", "base_rounded_total", "base_in_words", "base_discount_amount",
			"base_paid_amount", "base_write_off_amount"],
			this.frm.doc.currency != company_currency);

		this.frm.toggle_display(["plc_conversion_rate", "price_list_currency"],
			this.frm.doc.price_list_currency != company_currency);

		// set labels
		$.each(field_label_map, function(fname, label) {
			me.frm.fields_dict[fname].set_label(label);
		});

		var show =cint(cur_frm.doc.discount_amount) ||
				((cur_frm.doc.taxes || []).filter(function(d) {return d.included_in_print_rate===1}).length);

		if(frappe.meta.get_docfield(cur_frm.doctype, "net_total"))
			cur_frm.toggle_display("net_total", show);

		if(frappe.meta.get_docfield(cur_frm.doctype, "base_net_total"))
			cur_frm.toggle_display("base_net_total", (show && (me.frm.doc.currency != company_currency)));

	},

	change_grid_labels: function(company_currency) {
		var me = this;
		var field_label_map = {};

		var setup_field_label_map = function(fields_list, currency, parentfield) {
			var grid_doctype = me.frm.fields_dict[parentfield].grid.doctype;
			$.each(fields_list, function(i, fname) {
				var docfield = frappe.meta.docfield_map[grid_doctype][fname];
				if(docfield) {
					var label = __(docfield.label || "").replace(/\([^\)]*\)/g, "");
					field_label_map[grid_doctype + "-" + fname] =
						label.trim() + " (" + __(currency) + ")";
				}
			});
		}

		setup_field_label_map(["base_rate", "base_net_rate", "base_price_list_rate", "base_amount", "base_net_amount"],
			company_currency, "items");

		setup_field_label_map(["rate", "net_rate", "price_list_rate", "amount", "net_amount"],
			this.frm.doc.currency, "items");

		if(this.frm.fields_dict["taxes"]) {
			setup_field_label_map(["tax_amount", "total", "tax_amount_after_discount"], this.frm.doc.currency, "taxes");

			setup_field_label_map(["base_tax_amount", "base_total", "base_tax_amount_after_discount"], company_currency, "taxes");
		}

		if(this.frm.fields_dict["advances"]) {
			setup_field_label_map(["advance_amount", "allocated_amount"],
				this.frm.doc.party_account_currency, "advances");
		}

		// toggle columns
		var item_grid = this.frm.fields_dict["items"].grid;
		$.each(["base_rate", "base_price_list_rate", "base_amount"], function(i, fname) {
			if(frappe.meta.get_docfield(item_grid.doctype, fname))
				item_grid.set_column_disp(fname, me.frm.doc.currency != company_currency);
		});

		var show = (cint(cur_frm.doc.discount_amount)) ||
			((cur_frm.doc.taxes || []).filter(function(d) {return d.included_in_print_rate===1}).length);

		$.each(["net_rate", "net_amount"], function(i, fname) {
			if(frappe.meta.get_docfield(item_grid.doctype, fname))
				item_grid.set_column_disp(fname, show);
		});

		$.each(["base_net_rate", "base_net_amount"], function(i, fname) {
			if(frappe.meta.get_docfield(item_grid.doctype, fname))
				item_grid.set_column_disp(fname, (show && (me.frm.doc.currency != company_currency)));
		});

		// set labels
		var $wrapper = $(this.frm.wrapper);
		$.each(field_label_map, function(fname, label) {
			fname = fname.split("-");
			var df = frappe.meta.get_docfield(fname[0], fname[1], me.frm.doc.name);
			if(df) df.label = label;
		});
	},

	recalculate: function() {
		this.calculate_taxes_and_totals();
	},

	recalculate_values: function() {
		this.calculate_taxes_and_totals();
	},

	calculate_charges: function() {
		this.calculate_taxes_and_totals();
	},

	ignore_pricing_rule: function() {
		this.apply_pricing_rule();
	},

	apply_pricing_rule: function(item, calculate_taxes_and_totals) {
		var me = this;
		var args = this._get_args(item);
		if (!(args.items && args.items.length)) {
			if(calculate_taxes_and_totals) me.calculate_taxes_and_totals();
			return;
		}

		return this.frm.call({
			method: "accounts.doctype.pricing_rule.pricing_rule.apply_pricing_rule",
			args: {	args: args },
			callback: function(r) {
				if (!r.exc && r.message) {
					me._set_values_for_item_list(r.message);
					if(item) me.set_gross_profit(item);
					if(calculate_taxes_and_totals) me.calculate_taxes_and_totals();
				}
			}
		});
	},

	_get_args: function(item) {
		var me = this;
		return {
			"items": this._get_item_list(item),
			"customer": me.frm.doc.customer,
			"customer_group": me.frm.doc.customer_group,
			"territory": me.frm.doc.territory,
			"supplier": me.frm.doc.supplier,
			"supplier_type": me.frm.doc.supplier_type,
			"currency": me.frm.doc.currency,
			"conversion_rate": me.frm.doc.conversion_rate,
			"price_list": me.frm.doc.selling_price_list || me.frm.doc.buying_price_list,
			"price_list_currency": me.frm.doc.price_list_currency,
			"plc_conversion_rate": me.frm.doc.plc_conversion_rate,
			"company": me.frm.doc.company,
			"transaction_date": me.frm.doc.transaction_date || me.frm.doc.posting_date,
			"campaign": me.frm.doc.campaign,
			"sales_partner": me.frm.doc.sales_partner,
			"ignore_pricing_rule": me.frm.doc.ignore_pricing_rule,
			"doctype": me.frm.doc.doctype,
			"name": me.frm.doc.name
		};
	},

	_get_item_list: function(item) {
		var item_list = [];
		var append_item = function(d) {
			if (d.item_code) {
				item_list.push({
					"doctype": d.doctype,
					"name": d.name,
					"item_code": d.item_code,
					"item_group": d.item_group,
					"brand": d.brand,
					"qty": d.qty,
					"parenttype": d.parenttype,
					"parent": d.parent
				});
			}
		};

		if (item) {
			append_item(item);
		} else {
			$.each(this.frm.doc["items"] || [], function(i, d) {
				append_item(d);
			});
		}
		return item_list;
	},

	_set_values_for_item_list: function(children) {
		var me = this;
		var price_list_rate_changed = false;
		for(var i=0, l=children.length; i<l; i++) {
			var d = children[i];
			var existing_pricing_rule = frappe.model.get_value(d.doctype, d.name, "pricing_rule");

			for(var k in d) {
				var v = d[k];
				if (["doctype", "name"].indexOf(k)===-1) {
					if(k=="price_list_rate") {
						if(flt(v) != flt(d.price_list_rate)) price_list_rate_changed = true;
					}
					frappe.model.set_value(d.doctype, d.name, k, v);
				}
			}

			// if pricing rule set as blank from an existing value, apply price_list
			if(!me.frm.doc.ignore_pricing_rule && existing_pricing_rule && !d.pricing_rule) {
				me.apply_price_list(frappe.get_doc(d.doctype, d.name));
			}
		}

		if(!price_list_rate_changed) me.calculate_taxes_and_totals();
	},

	apply_price_list: function(item) {
		var me = this;
		var args = this._get_args(item);
		if (!((args.items && args.items.length) || args.price_list)) {
			return;
		}

		return this.frm.call({
			method: "stock.get_item_details.apply_price_list",
			args: {	args: args },
			callback: function(r) {
				if (!r.exc) {
					me.in_apply_price_list = true;
					me.frm.set_value("price_list_currency", r.message.parent.price_list_currency);
					me.frm.set_value("plc_conversion_rate", r.message.parent.plc_conversion_rate);
					me.in_apply_price_list = false;

					if(args.items.length) {
						me._set_values_for_item_list(r.message.children);
					}
				}
			}
		});
	},

	get_item_wise_taxes_html: function() {
		var item_tax = {};
		var tax_accounts = [];
		var company_currency = this.get_company_currency();

		$.each(this.frm.doc["taxes"] || [], function(i, tax) {
			var tax_amount_precision = precision("tax_amount", tax);
			var tax_rate_precision = precision("rate", tax);
			$.each(JSON.parse(tax.item_wise_tax_detail || '{}'),
				function(item_code, tax_data) {
					if(!item_tax[item_code]) item_tax[item_code] = {};
					if($.isArray(tax_data)) {
						var tax_rate = "";
						if(tax_data[0] != null) {
							tax_rate = (tax.charge_type === "Actual") ?
								format_currency(flt(tax_data[0], tax_amount_precision), company_currency, tax_amount_precision) :
								(flt(tax_data[0], tax_rate_precision) + "%");
						}
						var tax_amount = format_currency(flt(tax_data[1], tax_amount_precision), company_currency,
							tax_amount_precision);

						item_tax[item_code][tax.name] = [tax_rate, tax_amount];
					} else {
						item_tax[item_code][tax.name] = [flt(tax_data, tax_rate_precision) + "%", ""];
					}
				});
			tax_accounts.push([tax.name, tax.account_head]);
		});

		var headings = $.map([__("Item Name")].concat($.map(tax_accounts, function(head) { return head[1]; })),
			function(head) { return '<th style="min-width: 100px;">' + (head || "") + "</th>" }).join("\n");

		var distinct_item_names = [];
		var distinct_items = [];
		$.each(this.frm.doc["items"] || [], function(i, item) {
			if(distinct_item_names.indexOf(item.item_code || item.item_name)===-1) {
				distinct_item_names.push(item.item_code || item.item_name);
				distinct_items.push(item);
			}
		});

		var rows = $.map(distinct_items, function(item) {
			var item_tax_record = item_tax[item.item_code || item.item_name];
			if(!item_tax_record) { return null; }
			return repl("<tr><td>%(item_name)s</td>%(taxes)s</tr>", {
				item_name: item.item_name,
				taxes: $.map(tax_accounts, function(head) {
					return item_tax_record[head[0]] ?
						"<td>(" + item_tax_record[head[0]][0] + ") " + item_tax_record[head[0]][1] + "</td>" :
						"<td></td>";
				}).join("\n")
			});
		}).join("\n");

		if(!rows) return "";
		return '<p><a class="h6 text-muted" href="#" onclick="$(\'.tax-break-up\').toggleClass(\'hide\'); return false;">'
			+ __("Show tax break-up") + '</a><br><br></p>\
		<div class="tax-break-up hide" style="overflow-x: auto;"><table class="table table-bordered table-hover">\
			<thead><tr>' + headings + '</tr></thead> \
			<tbody>' + rows + '</tbody> \
		</table></div>';
	},

	validate_company_and_party: function() {
		var me = this;
		var valid = true;

		$.each(["company", "customer"], function(i, fieldname) {
			if(frappe.meta.has_field(me.frm.doc.doctype, fieldname && me.frm.doc.doctype != "Purchase Order")) {
				if (!me.frm.doc[fieldname]) {
					msgprint(__("Please specify") + ": " +
						frappe.meta.get_label(me.frm.doc.doctype, fieldname, me.frm.doc.name) +
						". " + __("It is needed to fetch Item Details."));
						valid = false;
				}
			}
		});
		return valid;
	},

	get_terms: function() {
		var me = this;
		if(this.frm.doc.tc_name) {
			return this.frm.call({
				method: "frappe.client.get_value",
				args: {
					doctype: "Terms and Conditions",
					fieldname: "terms",
					filters: { name: this.frm.doc.tc_name },
				},
			});
		}
	},

	taxes_and_charges: function() {
		var me = this;
		if(this.frm.doc.taxes_and_charges) {
			return this.frm.call({
				method: "controllers.accounts_controller.get_taxes_and_charges",
				args: {
					"master_doctype": frappe.meta.get_docfield(this.frm.doc.doctype, "taxes_and_charges",
						this.frm.doc.name).options,
					"master_name": this.frm.doc.taxes_and_charges,
				},
				callback: function(r) {
					if(!r.exc) {
						me.frm.set_value("taxes", r.message);
						me.calculate_taxes_and_totals();
					}
				}
			});
		}
	},

	show_item_wise_taxes: function() {
		if(this.frm.fields_dict.other_charges_calculation) {
			var html = this.get_item_wise_taxes_html();
			if (html) {
				this.frm.toggle_display("other_charges_calculation", true);
				$(this.frm.fields_dict.other_charges_calculation.wrapper).html(html);
			} else {
				this.frm.toggle_display("other_charges_calculation", false);
			}
		}
	},

	is_recurring: function() {
		// set default values for recurring documents
		if(this.frm.doc.is_recurring && this.frm.doc.__islocal) {
			frappe.msgprint(__("Please set recurring after saving"));
			this.frm.set_value('is_recurring', 0);
			return;
		}

		if(this.frm.doc.is_recurring) {
			if(!this.frm.doc.recurring_id) {
				this.frm.set_value('recurring_id', this.frm.doc.name);
			}
			
			var owner_email = this.frm.doc.owner=="Administrator"
				? frappe.user_info("Administrator").email
				: this.frm.doc.owner;

			this.frm.doc.notification_email_address = $.map([cstr(owner_email),
				cstr(this.frm.doc.contact_email)], function(v) { return v || null; }).join(", ");
			this.frm.doc.repeat_on_day_of_month = frappe.datetime.str_to_obj(this.frm.doc.posting_date).getDate();
		}

		refresh_many(["notification_email_address", "repeat_on_day_of_month"]);
	},

	from_date: function() {
		// set to_date
		if(this.frm.doc.from_date) {
			var recurring_type_map = {'Monthly': 1, 'Quarterly': 3, 'Half-yearly': 6,
				'Yearly': 12};

			var months = recurring_type_map[this.frm.doc.recurring_type];
			if(months) {
				var to_date = frappe.datetime.add_months(this.frm.doc.from_date,
					months);
				this.frm.doc.to_date = frappe.datetime.add_days(to_date, -1);
				refresh_field('to_date');
			}
		}
	},
	
	set_gross_profit: function(item) {
		if (this.frm.doc.doctype == "Sales Order" && item.valuation_rate) {
			rate = flt(item.rate) * flt(this.frm.doc.conversion_rate || 1);
			item.gross_profit = flt(((rate - item.valuation_rate) * item.qty), precision("amount", item));
		}
	},


	show_stock_ledger: function() {
		var me = this;
		if(this.frm.doc.docstatus===1) {
			cur_frm.add_custom_button(__("Stock Ledger"), function() {
				frappe.route_options = {
					voucher_no: me.frm.doc.name,
					from_date: me.frm.doc.posting_date,
					to_date: me.frm.doc.posting_date,
					company: me.frm.doc.company
				};
				frappe.set_route("query-report", "Stock Ledger");
			}, __("View"));
		}

	},

	show_general_ledger: function() {
		var me = this;
		if(this.frm.doc.docstatus===1) {
			cur_frm.add_custom_button(__('Accounting Ledger'), function() {
				frappe.route_options = {
					voucher_no: me.frm.doc.name,
					from_date: me.frm.doc.posting_date,
					to_date: me.frm.doc.posting_date,
					company: me.frm.doc.company,
					group_by_voucher: false
				};
				frappe.set_route("query-report", "General Ledger");
			}, __("View"));
		}
	},
	onload: function() {
		var me = this;
		if(this.frm.doc.__islocal) {
			var today = get_today(),
				currency = frappe.defaults.get_user_default("currency");

			$.each(["posting_date", "transaction_date"], function(i, fieldname) {
				if (me.frm.fields_dict[fieldname] && !me.frm.doc[fieldname] && me.frm[fieldname]) {
					me.frm.set_value(fieldname, me.frm[fieldname]);
				}
			});

			$.each({
				posting_date: today,
				transaction_date: today,
				currency: currency,
				price_list_currency: currency,
				status: "Draft",
				is_subcontracted: "No",
			}, function(fieldname, value) {
				if(me.frm.fields_dict[fieldname] && !me.frm.doc[fieldname])
					me.frm.set_value(fieldname, value);
			});

			if(this.frm.doc.company && !this.frm.doc.amended_from) {
				cur_frm.script_manager.trigger("company");
			}
		}

		if(this.frm.fields_dict["taxes"]) {
			this["taxes_remove"] = this.calculate_taxes_and_totals;
		}

		if(this.frm.fields_dict["items"]) {
			this["items_remove"] = this.calculate_taxes_and_totals;
		}

		if(this.frm.fields_dict["recurring_print_format"]) {
			this.frm.set_query("recurring_print_format", function(doc) {
				return{
					filters: [
						['Print Format', 'doc_type', '=', cur_frm.doctype],
					]
				}
			});
		}

		if(this.frm.fields_dict["return_against"]) {
			this.frm.set_query("return_against", function(doc) {
				var filters = {
					"docstatus": 1,
					"is_return": 0,
					"company": doc.company
				};
				if (me.frm.fields_dict["customer"] && doc.customer) filters["customer"] = doc.customer;
				if (me.frm.fields_dict["supplier"] && doc.supplier) filters["supplier"] = doc.supplier;

				return {
					filters: filters
				}
			});
		}
		this.setup_queries();
		// warehouse query if company
		if (this.frm.fields_dict.company) {
			this.setup_warehouse_query();
		}
	},
	clear_address_and_contact: function(frm) {
		$(frm.fields_dict['address_html'].wrapper).html("");
		frm.fields_dict['contact_html'] && $(frm.fields_dict['contact_html'].wrapper).html("");
	},
	
	render_address_and_contact: function(frm) {
		// render address
		$(frm.fields_dict['address_html'].wrapper)
			.html(frappe.render_template("address_list",
				cur_frm.doc.__onload))
			.find(".btn-address").on("click", function() {
				new_doc("Address");
			});

		// render contact
		if(frm.fields_dict['contact_html']) {
			$(frm.fields_dict['contact_html'].wrapper)
				.html(frappe.render_template("contact_list",
					cur_frm.doc.__onload))
				.find(".btn-contact").on("click", function() {
					new_doc("Contact");
				}
			);
		}
	},

	copy_value_in_all_row: function(doc, dt, dn, table_fieldname, fieldname) {
		var d = locals[dt][dn];
		if(d[fieldname]){
			var cl = doc[table_fieldname] || [];
			for(var i = 0; i < cl.length; i++) {
				if(!cl[i][fieldname]) cl[i][fieldname] = d[fieldname];
			}
		}
		refresh_field(table_fieldname);
	},
	get_currency: function(company) {
		if(!company && cur_frm)
			company = cur_frm.doc.company;
		if(company)
			return frappe.get_doc(":Company", company).default_currency || frappe.boot.sysdefaults.currency;
		else
			return frappe.boot.sysdefaults.currency;
	},

	toggle_naming_series: function() {
		if(cur_frm.fields_dict.naming_series) {
			cur_frm.toggle_display("naming_series", cur_frm.doc.__islocal?true:false);
		}
	},

	hide_company: function() {
		if(cur_frm.fields_dict.company) {
			var companies = Object.keys(locals[":Company"] || {});
			if(companies.length === 1) {
				if(!cur_frm.doc.company) cur_frm.set_value("company", companies[0]);
				cur_frm.toggle_display("company", false);
			} else if(last_selected_company) {
				if(!cur_frm.doc.company) cur_frm.set_value("company", last_selected_company);
			}
		}
	},

	setup_serial_no: function() {
		var grid_row = cur_frm.open_grid_row();
		if(!grid_row.fields_dict.serial_no ||
			grid_row.fields_dict.serial_no.get_status()!=="Write") return;

		var $btn = $('<button class="btn btn-sm btn-default">'+__("Add Serial No")+'</button>')
			.appendTo($("<div>")
				.css({"margin-bottom": "10px", "margin-top": "10px"})
				.appendTo(grid_row.fields_dict.serial_no.$wrapper));

		$btn.on("click", function() {
			var d = new frappe.ui.Dialog({
				title: __("Add Serial No"),
				fields: [
					{
						"fieldtype": "Link",
						"options": "Serial No",
						"label": __("Serial No"),
						"get_query": function () {
							return {
								filters: {
									item_code:grid_row.doc.item_code ,
									warehouse:cur_frm.doc.is_return ? null : grid_row.doc.warehouse
								}
							}
						}
					},
					{
						"fieldtype": "Button",
						"label": __("Add")
					}
				]
			});

			d.get_input("add").on("click", function() {
				var serial_no = d.get_value("serial_no");
				if(serial_no) {
					var val = (grid_row.doc.serial_no || "").split("\n").concat([serial_no]).join("\n");
					grid_row.fields_dict.serial_no.set_model_value(val.trim());
				}
				d.hide();
				return false;
			});

			d.show();
		});
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
		utils.get_party_details(this.frm, null, null, function(){me.apply_pricing_rule()});
	},

	supplier_address: function() {
		utils.get_address_display(this.frm);
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


	company: function() {
		var me = this;
		if (frappe.meta.get_docfield(this.frm.doctype, "shipping_address") 
			&& !this.frm.doc.shipping_address) {
				get_shipping_address(this.frm)
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
		
		get_address_display(this.frm, "shipping_address", 
			"shipping_address_display", is_your_company_address=true)
	},
	calculate_taxes_and_totals: function(update_paid_amount) {
		this.discount_amount_applied = false;
		this._calculate_taxes_and_totals();

		if (frappe.meta.get_docfield(this.frm.doc.doctype, "discount_amount"))
			this.apply_discount_amount();

		// Advance calculation applicable to Sales /Purchase Invoice
		if(in_list(["Sales Invoice", "Purchase Invoice"], this.frm.doc.doctype)
			 && this.frm.doc.docstatus < 2 && !this.frm.doc.is_return) {
				 this.calculate_total_advance(update_paid_amount);
		}

		// Sales person's commission
		if(in_list(["Quotation", "Sales Order", "Delivery Note", "Sales Invoice"], this.frm.doc.doctype)) {
			this.calculate_commission();
			this.calculate_contribution();
		}

		this.frm.refresh_fields();
	},

	_calculate_taxes_and_totals: function() {
		this.validate_conversion_rate();
		this.calculate_item_values();
		this.initialize_taxes();
		this.determine_exclusive_rate();
		this.calculate_net_total();
		this.calculate_taxes();
		this.manipulate_grand_total_for_inclusive_tax();
		this.calculate_totals();
		this._cleanup();
		this.show_item_wise_taxes();
	},

	validate_conversion_rate: function() {
		this.frm.doc.conversion_rate = flt(this.frm.doc.conversion_rate, precision("conversion_rate"));
		var conversion_rate_label = frappe.meta.get_label(this.frm.doc.doctype, "conversion_rate",
			this.frm.doc.name);
		var company_currency = this.get_company_currency();

		if(!this.frm.doc.conversion_rate) {
			if(this.frm.doc.currency == company_currency) {
				this.frm.set_value("conversion_rate", 1);
			} else {
				frappe.throw(repl('%(conversion_rate_label)s' +
					__(' is mandatory. Maybe Currency Exchange record is not created for ') +
					'%(from_currency)s' + __(" to ") + '%(to_currency)s',
					{
						"conversion_rate_label": conversion_rate_label,
						"from_currency": this.frm.doc.currency,
						"to_currency": company_currency
					}));
			}
			
		}
	},

	calculate_item_values: function() {
		var me = this;

		if (!this.discount_amount_applied) {
			$.each(this.frm.doc["items"] || [], function(i, item) {
				frappe.model.round_floats_in(item);
				item.net_rate = item.rate;
				item.amount = flt(item.rate * item.qty, precision("amount", item));
				if(item.doctype=="Estimation Item"){
					item.amount=item.amount+item.cost_of_labour;
				}
				item.net_amount = item.amount;
				item.item_tax_amount = 0.0;

				me.set_in_company_currency(item, ["price_list_rate", "rate", "amount", "net_rate", "net_amount"]);
			});
		}
	},

	set_in_company_currency: function(doc, fields) {
		var me = this;
		$.each(fields, function(i, f) {
			doc["base_"+f] = flt(flt(doc[f], precision(f, doc)) * me.frm.doc.conversion_rate, precision("base_" + f, doc));
		})
	},

	initialize_taxes: function() {
		var me = this;

		$.each(this.frm.doc["taxes"] || [], function(i, tax) {
			tax.item_wise_tax_detail = {};
			tax_fields = ["total", "tax_amount_after_discount_amount",
				"tax_amount_for_current_item", "grand_total_for_current_item",
				"tax_fraction_for_current_item", "grand_total_fraction_for_current_item"]

			if (cstr(tax.charge_type) != "Actual" &&
				!(me.discount_amount_applied && me.frm.doc.apply_discount_on=="Grand Total"))
					tax_fields.push("tax_amount");

			$.each(tax_fields, function(i, fieldname) { tax[fieldname] = 0.0 });

			if (!this.discount_amount_applied) {
				cur_frm.cscript.validate_taxes_and_charges(tax.doctype, tax.name);
				me.validate_inclusive_tax(tax);
			}
			frappe.model.round_floats_in(tax);
		});
	},

	determine_exclusive_rate: function() {
		var me = this;

		var has_inclusive_tax = false;
		$.each(me.frm.doc["taxes"] || [], function(i, row) {
			if(cint(row.included_in_print_rate)) has_inclusive_tax = true;
		})
		if(has_inclusive_tax==false) return;

		$.each(me.frm.doc["items"] || [], function(n, item) {
			var item_tax_map = me._load_item_tax_rate(item.item_tax_rate);
			var cumulated_tax_fraction = 0.0;

			$.each(me.frm.doc["taxes"] || [], function(i, tax) {
				tax.tax_fraction_for_current_item = me.get_current_tax_fraction(tax, item_tax_map);

				if(i==0) {
					tax.grand_total_fraction_for_current_item = 1 + tax.tax_fraction_for_current_item;
				} else {
					tax.grand_total_fraction_for_current_item =
						me.frm.doc["taxes"][i-1].grand_total_fraction_for_current_item +
						tax.tax_fraction_for_current_item;
				}

				cumulated_tax_fraction += tax.tax_fraction_for_current_item;
			});

			if(cumulated_tax_fraction && !me.discount_amount_applied) {
				item.net_amount = flt(item.amount / (1 + cumulated_tax_fraction), precision("net_amount", item));
				item.net_rate = flt(item.net_amount / item.qty, precision("net_rate", item));

				me.set_in_company_currency(item, ["net_rate", "net_amount"]);
			}
		});
	},

	get_current_tax_fraction: function(tax, item_tax_map) {
		// Get tax fraction for calculating tax exclusive amount
		// from tax inclusive amount
		var current_tax_fraction = 0.0;

		if(cint(tax.included_in_print_rate)) {
			var tax_rate = this._get_tax_rate(tax, item_tax_map);

			if(tax.charge_type == "On Net Total") {
				current_tax_fraction = (tax_rate / 100.0);

			} else if(tax.charge_type == "On Previous Row Amount") {
				current_tax_fraction = (tax_rate / 100.0) *
					this.frm.doc["taxes"][cint(tax.row_id) - 1].tax_fraction_for_current_item;

			} else if(tax.charge_type == "On Previous Row Total") {
				current_tax_fraction = (tax_rate / 100.0) *
					this.frm.doc["taxes"][cint(tax.row_id) - 1].grand_total_fraction_for_current_item;
			}
		}

		if(tax.add_deduct_tax) {
			current_tax_fraction *= (tax.add_deduct_tax == "Deduct") ? -1.0 : 1.0;
		}
		return current_tax_fraction;
	},

	_get_tax_rate: function(tax, item_tax_map) {
		return (keys(item_tax_map).indexOf(tax.account_head) != -1) ?
			flt(item_tax_map[tax.account_head], precision("rate", tax)) : tax.rate;
	},

	calculate_net_total: function() {
		var me = this;
		this.frm.doc.total = this.frm.doc.base_total = this.frm.doc.net_total = this.frm.doc.base_net_total = 0.0;

		$.each(this.frm.doc["items"] || [], function(i, item) {
			me.frm.doc.total += item.amount;
			me.frm.doc.base_total += item.base_amount;
			me.frm.doc.net_total += item.net_amount;
			me.frm.doc.base_net_total += item.base_net_amount;
		});

		frappe.model.round_floats_in(this.frm.doc, ["total", "base_total", "net_total", "base_net_total"]);
	},

	calculate_taxes: function() {
		var me = this;
		var actual_tax_dict = {};

		// maintain actual tax rate based on idx
		$.each(this.frm.doc["taxes"] || [], function(i, tax) {
			if (tax.charge_type == "Actual") {
				actual_tax_dict[tax.idx] = flt(tax.tax_amount, precision("tax_amount", tax));
			}
		});

		$.each(this.frm.doc["items"] || [], function(n, item) {
			var item_tax_map = me._load_item_tax_rate(item.item_tax_rate);

			$.each(me.frm.doc["taxes"] || [], function(i, tax) {
				// tax_amount represents the amount of tax for the current step
				var current_tax_amount = me.get_current_tax_amount(item, tax, item_tax_map);

				// Adjust divisional loss to the last item
				if (tax.charge_type == "Actual") {
					actual_tax_dict[tax.idx] -= current_tax_amount;
					if (n == me.frm.doc["items"].length - 1) {
						current_tax_amount += actual_tax_dict[tax.idx]
					}
				}

				// accumulate tax amount into tax.tax_amount
				if (tax.charge_type != "Actual" &&
					!(me.discount_amount_applied && me.frm.doc.apply_discount_on=="Grand Total"))
						tax.tax_amount += current_tax_amount;

				// store tax_amount for current item as it will be used for
				// charge type = 'On Previous Row Amount'
				tax.tax_amount_for_current_item = current_tax_amount;

				// tax amount after discount amount
				tax.tax_amount_after_discount_amount += current_tax_amount;

				// for buying
				if(tax.category) {
					// if just for valuation, do not add the tax amount in total
					// hence, setting it as 0 for further steps
					current_tax_amount = (tax.category == "Valuation") ? 0.0 : current_tax_amount;

					current_tax_amount *= (tax.add_deduct_tax == "Deduct") ? -1.0 : 1.0;
				}

				// Calculate tax.total viz. grand total till that step
				// note: grand_total_for_current_item contains the contribution of
				// item's amount, previously applied tax and the current tax on that item
				if(i==0) {
					tax.grand_total_for_current_item = flt(item.net_amount + current_tax_amount, precision("total", tax));
				} else {
					tax.grand_total_for_current_item =
						flt(me.frm.doc["taxes"][i-1].grand_total_for_current_item + current_tax_amount, precision("total", tax));
				}

				// in tax.total, accumulate grand total for each item
				tax.total += tax.grand_total_for_current_item;

				// set precision in the last item iteration
				if (n == me.frm.doc["items"].length - 1) {
					me.round_off_totals(tax);

					// adjust Discount Amount loss in last tax iteration
					if ((i == me.frm.doc["taxes"].length - 1) && me.discount_amount_applied 
							&& me.frm.doc.apply_discount_on == "Grand Total" && me.frm.doc.discount_amount)
						me.adjust_discount_amount_loss(tax);
				}
			});
		});
	},

	_load_item_tax_rate: function(item_tax_rate) {
		return item_tax_rate ? JSON.parse(item_tax_rate) : {};
	},

	get_current_tax_amount: function(item, tax, item_tax_map) {
		var tax_rate = this._get_tax_rate(tax, item_tax_map);
		var current_tax_amount = 0.0;

		if(tax.charge_type == "Actual") {
			// distribute the tax amount proportionally to each item row
			var actual = flt(tax.tax_amount, precision("tax_amount", tax));
			current_tax_amount = this.frm.doc.net_total ?
				((item.net_amount / this.frm.doc.net_total) * actual) : 0.0;

		} else if(tax.charge_type == "On Net Total") {
			current_tax_amount = (tax_rate / 100.0) * item.net_amount;

		} else if(tax.charge_type == "On Previous Row Amount") {
			current_tax_amount = (tax_rate / 100.0) *
				this.frm.doc["taxes"][cint(tax.row_id) - 1].tax_amount_for_current_item;

		} else if(tax.charge_type == "On Previous Row Total") {
			current_tax_amount = (tax_rate / 100.0) *
				this.frm.doc["taxes"][cint(tax.row_id) - 1].grand_total_for_current_item;
		}

		current_tax_amount = flt(current_tax_amount, precision("tax_amount", tax));

		this.set_item_wise_tax(item, tax, tax_rate, current_tax_amount);

		return current_tax_amount;
	},

	set_item_wise_tax: function(item, tax, tax_rate, current_tax_amount) {
		// store tax breakup for each item
		var key = item.item_code || item.item_name;
		var item_wise_tax_amount = current_tax_amount * this.frm.doc.conversion_rate;
		if (tax.item_wise_tax_detail && tax.item_wise_tax_detail[key])
			item_wise_tax_amount += tax.item_wise_tax_detail[key][1]

		tax.item_wise_tax_detail[key] = [tax_rate,flt(item_wise_tax_amount, precision("base_tax_amount", tax))]

	},

	round_off_totals: function(tax) {
		tax.total = flt(tax.total, precision("total", tax));
		tax.tax_amount = flt(tax.tax_amount, precision("tax_amount", tax));
		tax.tax_amount_after_discount_amount = flt(tax.tax_amount_after_discount_amount, precision("tax_amount", tax));

		this.set_in_company_currency(tax, ["total", "tax_amount", "tax_amount_after_discount_amount"]);
	},

	adjust_discount_amount_loss: function(tax) {
		var discount_amount_loss = this.frm.doc.grand_total - flt(this.frm.doc.discount_amount) - tax.total;
		tax.tax_amount_after_discount_amount = flt(tax.tax_amount_after_discount_amount +
			discount_amount_loss, precision("tax_amount", tax));
		tax.total = flt(tax.total + discount_amount_loss, precision("total", tax));
		
		this.set_in_company_currency(tax, ["total", "tax_amount_after_discount_amount"]);
	},
	
	manipulate_grand_total_for_inclusive_tax: function() {
		var me = this;
		// if fully inclusive taxes and diff
		if (this.frm.doc["taxes"] && this.frm.doc["taxes"].length) {
			var all_inclusive = frappe.utils.all(this.frm.doc["taxes"].map(function(d) {
				return cint(d.included_in_print_rate);
			}));

			if (all_inclusive) {
				var last_tax = me.frm.doc["taxes"].slice(-1)[0];

				var diff = me.frm.doc.total - flt(last_tax.total, precision("grand_total"));

				if ( diff && Math.abs(diff) <= (2.0 / Math.pow(10, precision("tax_amount", last_tax))) ) {
					last_tax.tax_amount += diff;
					last_tax.tax_amount_after_discount += diff;
					last_tax.total += diff;
					
					this.set_in_company_currency(last_tax, 
						["total", "tax_amount", "tax_amount_after_discount_amount"]);
				}
			}
		}
	},

	calculate_totals: function() {
		// Changing sequence can cause roundiing issue and on-screen discrepency
		var me = this;
		var tax_count = this.frm.doc["taxes"] ? this.frm.doc["taxes"].length : 0;
		this.frm.doc.grand_total = flt(tax_count ? this.frm.doc["taxes"][tax_count - 1].total : this.frm.doc.net_total);

		if(in_list(["Quotation", "Sales Order", "Delivery Note", "Sales Invoice"], this.frm.doc.doctype)) {
			this.frm.doc.base_grand_total = (this.frm.doc.total_taxes_and_charges) ?
				flt(this.frm.doc.grand_total * this.frm.doc.conversion_rate) : this.frm.doc.base_net_total;
		} else {
			// other charges added/deducted
			this.frm.doc.taxes_and_charges_added = this.frm.doc.taxes_and_charges_deducted = 0.0;
			if(tax_count) {
				$.each(this.frm.doc["taxes"] || [], function(i, tax) {
					if (in_list(["Valuation and Total", "Total"], tax.category)) {
						if(tax.add_deduct_tax == "Add") {
							me.frm.doc.taxes_and_charges_added += flt(tax.tax_amount_after_discount_amount);
						} else {
							me.frm.doc.taxes_and_charges_deducted += flt(tax.tax_amount_after_discount_amount);
						}
					}
				})

				frappe.model.round_floats_in(this.frm.doc, ["taxes_and_charges_added", "taxes_and_charges_deducted"]);
			}

			this.frm.doc.base_grand_total = flt((this.frm.doc.taxes_and_charges_added || this.frm.doc.taxes_and_charges_deducted) ?
				flt(this.frm.doc.grand_total * this.frm.doc.conversion_rate) : this.frm.doc.base_net_total);

			this.set_in_company_currency(this.frm.doc, ["taxes_and_charges_added", "taxes_and_charges_deducted"]);
		}

		this.frm.doc.total_taxes_and_charges = flt(this.frm.doc.grand_total - this.frm.doc.net_total,
			precision("total_taxes_and_charges"));

		this.set_in_company_currency(this.frm.doc, ["total_taxes_and_charges"]);

		// Round grand total as per precision
		frappe.model.round_floats_in(this.frm.doc, ["grand_total", "base_grand_total"]);

		// rounded totals
		if(frappe.meta.get_docfield(this.frm.doc.doctype, "rounded_total", this.frm.doc.name)) {
			this.frm.doc.rounded_total = round_based_on_smallest_currency_fraction(this.frm.doc.grand_total, 
				this.frm.doc.currency, precision("rounded_total"));
		}
		if(frappe.meta.get_docfield(this.frm.doc.doctype, "base_rounded_total", this.frm.doc.name)) {
			var company_currency = this.get_company_currency();
			
			this.frm.doc.base_rounded_total = 
				round_based_on_smallest_currency_fraction(this.frm.doc.base_grand_total, 
					company_currency, precision("base_rounded_total"));
		}
	},

	_cleanup: function() {
		this.frm.doc.base_in_words = this.frm.doc.in_words = "";

		if(this.frm.doc["items"] && this.frm.doc["items"].length) {
			if(!frappe.meta.get_docfield(this.frm.doc["items"][0].doctype, "item_tax_amount", this.frm.doctype)) {
				$.each(this.frm.doc["items"] || [], function(i, item) {
					delete item["item_tax_amount"];
				});
			}
		}

		if(this.frm.doc["taxes"] && this.frm.doc["taxes"].length) {
			var temporary_fields = ["tax_amount_for_current_item", "grand_total_for_current_item",
				"tax_fraction_for_current_item", "grand_total_fraction_for_current_item"]

			if(!frappe.meta.get_docfield(this.frm.doc["taxes"][0].doctype, "tax_amount_after_discount_amount", this.frm.doctype)) {
				temporary_fields.push("tax_amount_after_discount_amount");
			}

			$.each(this.frm.doc["taxes"] || [], function(i, tax) {
				$.each(temporary_fields, function(i, fieldname) {
					delete tax[fieldname];
				});

				tax.item_wise_tax_detail = JSON.stringify(tax.item_wise_tax_detail);
			});
		}
	},

	apply_discount_amount: function() {
		var me = this;
		var distributed_amount = 0.0;

		if (this.frm.doc.discount_amount) {
			if(!this.frm.doc.apply_discount_on)
				frappe.throw(__("Please select Apply Discount On"));

			this.frm.set_value("base_discount_amount",
				flt(this.frm.doc.discount_amount * this.frm.doc.conversion_rate, precision("base_discount_amount")))

			var total_for_discount_amount = this.get_total_for_discount_amount();
			// calculate item amount after Discount Amount
			if (total_for_discount_amount) {
				$.each(this.frm.doc["items"] || [], function(i, item) {
					distributed_amount = flt(me.frm.doc.discount_amount) * item.net_amount / total_for_discount_amount;
					item.net_amount = flt(item.net_amount - distributed_amount, precision("base_amount", item));
					item.net_rate = flt(item.net_amount / item.qty, precision("net_rate", item));

					me.set_in_company_currency(item, ["net_rate", "net_amount"]);
				});

				this.discount_amount_applied = true;
				this._calculate_taxes_and_totals();
			}
		} else {
			this.frm.set_value("base_discount_amount", 0);
		}
	},

	get_total_for_discount_amount: function() {
		var me = this;

		if(this.frm.doc.apply_discount_on == "Net Total") {
			return this.frm.doc.net_total
		} else {
			var total_actual_tax = 0.0;
			var actual_taxes_dict = {};

			$.each(this.frm.doc["taxes"] || [], function(i, tax) {
				if (tax.charge_type == "Actual")
					actual_taxes_dict[tax.idx] = tax.tax_amount;
				else if (actual_taxes_dict[tax.row_id] !== null) {
					actual_tax_amount = flt(actual_taxes_dict[tax.row_id]) * flt(tax.rate) / 100;
					actual_taxes_dict[tax.idx] = actual_tax_amount;
				}
			});

			$.each(actual_taxes_dict, function(key, value) {
				if (value) total_actual_tax += value;
			});

			return flt(this.frm.doc.grand_total - total_actual_tax, precision("grand_total"));
		}
	},

	calculate_total_advance: function(update_paid_amount) {
		var total_allocated_amount = frappe.utils.sum($.map(this.frm.doc["advances"] || [], function(adv) {
			return flt(adv.allocated_amount, precision("allocated_amount", adv))
		}));
		this.frm.doc.total_advance = flt(total_allocated_amount, precision("total_advance"));

		this.calculate_outstanding_amount(update_paid_amount);
	},
	
	calculate_outstanding_amount: function(update_paid_amount) {
		// NOTE:
		// paid_amount and write_off_amount is only for POS Invoice
		// total_advance is only for non POS Invoice
		if(this.frm.doc.is_return || this.frm.doc.docstatus > 0) return;
		
		frappe.model.round_floats_in(this.frm.doc, ["grand_total", "total_advance", "write_off_amount"]);
		if(this.frm.doc.party_account_currency == this.frm.doc.currency) {	
			var total_amount_to_pay = flt((this.frm.doc.grand_total - this.frm.doc.total_advance 
				- this.frm.doc.write_off_amount), precision("grand_total"));
		} else {
			var total_amount_to_pay = flt(
				(flt(this.frm.doc.grand_total*this.frm.doc.conversion_rate, precision("grand_total")) 
					- this.frm.doc.total_advance - this.frm.doc.base_write_off_amount), 
				precision("base_grand_total")
			);
		}
		
		if(this.frm.doc.doctype == "Sales Invoice") {
			frappe.model.round_floats_in(this.frm.doc, ["paid_amount"]);
			
			if(this.frm.doc.is_pos) {
				if(!this.frm.doc.paid_amount || update_paid_amount===undefined || update_paid_amount) {
					this.frm.doc.paid_amount = flt(total_amount_to_pay);
				}
			} else {
				this.frm.doc.paid_amount = 0
			}
			this.set_in_company_currency(this.frm.doc, ["paid_amount"]);
			this.frm.refresh_field("paid_amount");
			this.frm.refresh_field("base_paid_amount");
			
			var paid_amount = (this.frm.doc.party_account_currency == this.frm.doc.currency) ? 
				this.frm.doc.paid_amount : this.frm.doc.base_paid_amount;
			
			var outstanding_amount =  flt(total_amount_to_pay - flt(paid_amount), 
				precision("outstanding_amount"));
				
		} else if(this.frm.doc.doctype == "Purchase Invoice") {
			var outstanding_amount = flt(total_amount_to_pay, precision("outstanding_amount"));
		}		
		this.frm.set_value("outstanding_amount", outstanding_amount);
	}
});

cur_frm.add_fetch('project', 'cost_center', 'cost_center');

// for backward compatibility: combine new and previous states
//$.extend(cur_frm.cscript, new erpnext.buying.SupplierQuotationController({frm: cur_frm}));

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

frappe.ui.form.on(cur_frm.doctype + " Item", "rate", function(frm, cdt, cdn) {
	var item = frappe.get_doc(cdt, cdn);
	frappe.model.round_floats_in(item, ["rate", "price_list_rate"]);

	if(item.price_list_rate) {
		item.discount_percentage = flt((1 - item.rate / item.price_list_rate) * 100.0, precision("discount_percentage", item));
	} else {
		item.discount_percentage = 0.0;
	}
	
	cur_frm.cscript.set_gross_profit(item);
	cur_frm.cscript.calculate_taxes_and_totals();
})

frappe.ui.form.on(cur_frm.cscript.tax_table, "rate", function(frm, cdt, cdn) {
	cur_frm.cscript.calculate_taxes_and_totals();
})

frappe.ui.form.on(cur_frm.cscript.tax_table, "tax_amount", function(frm, cdt, cdn) {
	cur_frm.cscript.calculate_taxes_and_totals();
})

frappe.ui.form.on(cur_frm.cscript.tax_table, "row_id", function(frm, cdt, cdn) {
	cur_frm.cscript.calculate_taxes_and_totals();
})

frappe.ui.form.on(cur_frm.cscript.tax_table, "included_in_print_rate", function(frm, cdt, cdn) {
	cur_frm.cscript.set_dynamic_labels();
	cur_frm.cscript.calculate_taxes_and_totals();
})

frappe.ui.form.on(cur_frm.doctype, "apply_discount_on", function(frm) {
	if(frm.doc.additional_discount_percentage) {
		frm.trigger("additional_discount_percentage");
	} else {
		cur_frm.cscript.calculate_taxes_and_totals();
	}
})

frappe.ui.form.on(cur_frm.doctype, "additional_discount_percentage", function(frm) {
	if (frm.via_discount_amount) {
		return;
	}

	if(!frm.doc.apply_discount_on) {
		frappe.msgprint(__("Please set 'Apply Additional Discount On'"));
		return
	}

	frm.via_discount_percentage = true;

	if(frm.doc.additional_discount_percentage && frm.doc.discount_amount) {
		// Reset discount amount and net / grand total
		frm.set_value("discount_amount", 0);
	}

	var total = flt(frm.doc[frappe.model.scrub(frm.doc.apply_discount_on)]);
	var discount_amount = flt(total*flt(frm.doc.additional_discount_percentage) / 100,
		precision("discount_amount"));

	frm.set_value("discount_amount", discount_amount);
	delete frm.via_discount_percentage;
});

frappe.ui.form.on(cur_frm.doctype, "discount_amount", function(frm) {
	frm.cscript.set_dynamic_labels();

	if (!frm.via_discount_percentage) {
		frm.via_discount_amount = true;
		frm.set_value("additional_discount_percentage", 0);
		delete frm.via_discount_amount;
	}

	frm.cscript.calculate_taxes_and_totals();
});
$.extend(cur_frm.cscript, new RFQSuppliers({frm: cur_frm}));

