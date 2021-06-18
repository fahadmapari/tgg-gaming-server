if (localStorage.getItem("logged_in") == "true" && (localStorage.getItem("user_role") == "admin" || localStorage.getItem("user_role") == "sub-admin")) {

    var reqData = {
        blocked_currentPageNumber: 1
    }

    function all_blocked_users() {
        // console.log("blocked users")
        fetch(`${base_url}/users/blocked`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    credentials: 'include'
                }
            }).then((responce) => responce.json())
            .then((result) => {
                // console.log("blocked user result--", result)
                blocked_users_list(result.blocklist)
                hideLoader()
            })
    }

    function blocked_users_list(users) {
        const {
            docs,
            totalPages
        } = users;
        if (docs.length == 0) {
            var html = `<h1 class="text-center mb-4 mt-5 bahnschrift">Users Not Found</h1>`
            document.getElementById("blocked_user").innerHTML = html
        } else {
            var html = ""

            docs.forEach((element, count) => {
                html += `<div class="w-100 black_bg bordered mb-5">
                            <div class="row mx-0 py-2 py-lg-4 px-lg-4 align-items-center">
                                <div class="col-12 col-lg-3 text-center">
                                    <p class="mb-0 black_input">${element.user.name}</p>
                                </div>
                                <div class="col-12 col-lg-4 text-center">
                                    <p class="mb-0 black_input">${element.user.email}</p>
                                </div>
                                <div class="col-12 col-lg-3 text-center">
                                    <p class="mb-0 black_input">${element.user.mobile}</p>
                                </div>
                                <div class="col-12 col-lg-2 text-center">
                                    <button class="btn btn-sm primary_btn" onclick="unblock_user('${element.user._id}','${element.user.name}')"><i class="fa fa-trash mr-2"></i>Unblock User</button>
                                </div>
                            </div>
                        </div>`
            });
            document.getElementById("blocked_user").innerHTML = html
            blocked_users_getPageButtons(totalPages)
        }
    }

    function blocked_users_page_list() {
        // console.log("blocked users pagination")
        showLoader()
        fetch(`${base_url}/users/blocked?page=${reqData.blocked_currentPageNumber}`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    credentials: 'include'
                }
            }).then((responce) => responce.json())
            .then((result) => {
                // console.log("blocked user result--", result)
                blocked_users_list(result.blocklist)
                hideLoader()
            })

    }

    function blocked_users_getPageButtons(pageCount) {
        $(".blocked-page-buttons").empty();

        /* Declaring next and previous page buttons */
        let previous_page_button = `
            <button class='blocked-previous-page-btn btn btn-sm page_btn mx-1' disabled>  
              <<
            </button>`;
        $(".blocked-page-buttons").append(previous_page_button);

        let next_page_button = `
            <button class='blocked-next-page-btn btn btn-sm page_btn mx-1'>  
              >>
            </button>`;

        /* rendering buttons according to page count */
        for (let index = 1; index <= pageCount; index++) {
            let pageNumberButtons = ` 
            <button class="btn btn-sm page_btn mx-1 blocked-page-button-number">
              ${index}
            </button>`;
            /* Appending buttons to table */
            $(".blocked-page-buttons").append(pageNumberButtons);
        }
        /* appending next page butoon at the last
         */
        $(".blocked-page-buttons").append(next_page_button);

        /* Enabling and disabling previous and next page buttons */
        if (reqData.blocked_currentPageNumber > 1) {
            $(".blocked-previous-page-btn").attr("disabled", false);
        }
        if (reqData.blocked_currentPageNumber === 1) {
            $(".blocked-next-page-btn").attr("disabled", false);
        }
        if (reqData.blocked_currentPageNumber == pageCount) {
            $(".blocked-next-page-btn").attr("disabled", true);
        }

        $(".blocked-page-button-number").on("click", (e) => {

            let clickedpageButton = e.target.innerText;
            reqData.blocked_currentPageNumber = parseInt(clickedpageButton);
            blocked_users_page_list(reqData);
        });

        $(".blocked-next-page-btn").on("click", () => {
            if (reqData.blocked_currentPageNumber == pageCount - 1) {
                $(".blocked-next-page-btn").attr("disabled", true);
            }
            reqData.blocked_currentPageNumber++;
            blocked_users_page_list(reqData);
        });


        $(".blocked-previous-page-btn").on("click", () => {
            if (reqData.blocked_currentPageNumber == 1) {
                $(".blocked-previous-page-btn").attr("disabled", true);
            }
            reqData.blocked_currentPageNumber--;
            blocked_users_page_list(reqData);;
        });
    }

    function unblock_user(userId, name) {
        swal({
                title: "Are you sure?",
                text: `Do You want to Unblock User ${name} `,
                icon: "warning",
                type: "warning",
                buttons: true,
                dangerMode: true,
            })
            .then((willDelete) => {
                if (willDelete) {
                    showLoader()
                    fetch(`${base_url}/users/${userId}/unblock`, {
                            method: "GET",
                            headers: {
                                "Content-Type": "application/json",
                                credentials: 'include'
                            }
                        }).then((responce) => responce.json())
                        .then((result) => {
                            // console.log("deleted result--", result)
                            if (result.status != undefined) {
                                swal({
                                    text: `${result.message}`,
                                    type: "error",
                                    icon: "error"
                                })
                            } else {
                                swal({
                                    text: `User Unblocked Successfully`,
                                    type: "success",
                                    icon: "success"
                                }).then(() => {
                                    window.location.href = "/admin/users.html"
                                })
                            }
                        })
                }

            })

    }

    all_blocked_users()
} else {
    window.location.href = "/admin/admin_login.html"
}