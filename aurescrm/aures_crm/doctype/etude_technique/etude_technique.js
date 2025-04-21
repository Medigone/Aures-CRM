// Copyright (c) 2024, Medigo and contributors
// For license information, please see license.txt


frappe.ui.form.on('Etude Technique', {
    setup: function(frm) {
        // Filter for 'technicien' field directly on the form
        frm.set_query('technicien', function() {
            // Return a Promise, as fetching the user list is asynchronous
            return new Promise((resolve) => {
                frappe.db.get_list('UserRole', {
                    filters: {
                        'role': 'Technicien Prepresse',
                        'parenttype': 'User' // Ensure we only get roles assigned to Users
                    },
                    fields: ['parent'], // Get the User names (which are the 'parent' field in UserRole)
                    pluck: 'parent',   // Return only the list of user names
                    limit: 0           // No limit, get all users with the role
                }).then(users_with_role => {
                    let filters_for_user = [
                        ['User', 'enabled', '=', 1] // Always filter for enabled users
                    ];

                    if (users_with_role && users_with_role.length > 0) {
                        // If users are found, add the 'in' filter
                        filters_for_user.push(['User', 'name', 'in', users_with_role]);
                    } else {
                        // If no users have the role, add a filter that will return no results
                        // This prevents showing all users if the list is empty.
                        filters_for_user.push(['User', 'name', '=', '------NOBODY------']);
                    }

                    // Resolve the promise with the filters object for the 'technicien' field
                    resolve({
                        filters: filters_for_user
                    });

                }).catch(() => {
                    // In case of error fetching roles, default to a filter that returns nothing
                    resolve({
                        filters: [
                            ['User', 'name', '=', '------ERROR------']
                        ]
                    });
                });
            });
        });
    }
});
