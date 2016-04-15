# -*- coding: utf-8 -*-
# Copyright (c) 2015, bobzz.zone@gmail.com and contributors
# For license information, please see license.txt
from __future__ import unicode_literals
import frappe
from frappe import db,throw,msgprint
from frappe.utils import flt,cint
from frappe.model.document import Document


class CallForBid(Document):
	pass
	def make_quotation(self):
		if not self.product or len(self.product)==0:
			frappe.throw("Please enter the product")
		if not self.supplier or len(self.supplier)==0:
			frappe.throw("Please specify the supplier")
		for s in self.supplier:
			product=[]
			for p in self.product:
				p.append({
					"doctype":"Supplier Quotation Item",
					"item_code":p.item,
					"qty":cint(p.qty)
				})
			quote = {
					"doctype":"Supplier Quotation",
					"transaction_date":self.date
				}
			quote.append(product)
			row=frappe.get_doc(quote)
			row.insert(ignore_permissions=True)
