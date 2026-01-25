// Copyright (c) 2026, Medigo and contributors
// For license information, please see license.txt

/**
 * List View customization for "Demande Faisabilite"
 *
 * Adds a Link field (Item) to filter Demande Faisabilite records
 * that contain the selected article in the child table "Articles Demande Faisabilite".
 */
frappe.listview_settings["Demande Faisabilite"] = {
	onload(listview) {
		const CHILD_DOCTYPE = "Articles Demande Faisabilite";
		const CHILD_FIELDNAME = "article";

		// Prevent duplicate injections if list view is reloaded in-place
		if (listview.__article_filter_added) return;
		listview.__article_filter_added = true;

		const $standard_filters = listview.page.page_form.find(".standard-filter-section");

		// Add a proper "standard filter" aligned with the others.
		// This points directly to the child table doctype + field.
		listview.page.add_field(
			{
				doctype: CHILD_DOCTYPE,
				fieldname: CHILD_FIELDNAME,
				fieldtype: "Link",
				options: "Item",
				label: "Article",
				placeholder: __("Article"),
				condition: "=",
				is_filter: 1,
				input_class: "input-sm",
				onchange: () => listview.filter_area?.debounced_refresh_list_view(),
			},
			$standard_filters.length ? $standard_filters : listview.page.page_form
		);
	},
};

