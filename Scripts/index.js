﻿var gxp = 0;

var material_list = {};

$.expr[':'].icontains = $.expr.createPseudo(function (text) {
    return function (e) {
        return $(e).text().toUpperCase().indexOf(text.toUpperCase()) >= 0;
    };
});

function get_guild_lv() {
    return Math.floor(gxp / 100);
}

function save_to_localStorage() {
    // save upgrade list

    var upgrade_save_str = JSON.stringify(guild_db().select("Done", "Upgrade"));

    localStorage.setItem("upgrade_record", upgrade_save_str);

    // save material list
    var material_save_list = {};

    $(".material_row").each(function () {
        var item_id = $(this).data("item-id");
        var had = $(this).find(".had").val();

        material_save_list[item_id] = had;
    });
    var material_save_str = JSON.stringify(material_save_list);

    localStorage.setItem("material_record", material_save_str);
}

function load_from_localStorage() {
    // load upgrade list

    var upgrade_record_array = JSON.parse(localStorage.getItem("upgrade_record"));

    $.each(upgrade_record_array, function (index, value) {
        var done = value[0];
        var upgrade_name = value[1];

        if (done == 1) {
            upgrade_done(upgrade_name);
        }
    });

    // load material list
    var material_record_list = JSON.parse(localStorage.getItem("material_record"));

    $.each(material_record_list, function (index, value) {
        var item_id = index;
        var had = value;

        $(".material_row[data-item-id='" + item_id.toString() + "']").find(".had").val(had.toString());
    });

    material_had_change();
}

function update_gxp_bar() {
    var precentage = gxp % 100;
    var next_gxp = gxp - precentage + 100;
    var guild_lv = get_guild_lv();
    $('#gxp_bar').css('width', precentage + '%').attr('aria-valuenow', precentage).text(gxp.toString() + " / " + next_gxp.toString());
    $('#guild_lv').text("Lv " + guild_lv.toString());
}

function update_upgrade_ready() {
    $(".material").each(function () {
        var ready = 0;
        // if done, then will be ready
        if ($(this).parent().find(".done > .glyphicon").hasClass("glyphicon-ok")) {
            ready = 2;
        } else {
            var upgrade_name = $(this).data("upgrade-name");

            var required_lv = guild_db({ Upgrade: upgrade_name }).first().LevelRequire;
            if (required_lv <= get_guild_lv()) {
                ready = 2;

                // check hierarchy first
                upgrade_hierarchy({ Upgrade: upgrade_name }).each(function (record, recordnumber) {
                    var need_upgrade = record["Need"];
                    if ($(".material[data-upgrade-name='" + need_upgrade + "']").parent().find(".done > .glyphicon").hasClass("glyphicon-remove")) {
                        ready = 0;
                    }
                });

                if (ready != 0) {
                    material_db({ Upgrade: upgrade_name }).each(function (record, recordnumber) {
                        if (get_material_had(record["ItemId"]) < record["ItemQuantity"]) {
                            ready = 1;
                        }
                    });
                }
            }
        }

        var glyphicon_elem = $(this).parent().find(".ready > .glyphicon");
        glyphicon_elem.removeClass();
        glyphicon_elem.addClass("glyphicon");
        if (ready == 0) {
            glyphicon_elem.addClass("glyphicon-remove");
        } else if (ready == 1) {
            glyphicon_elem.addClass("glyphicon-exclamation-sign");
        } else {
            glyphicon_elem.addClass("glyphicon-ok");
        }
    });
}

function upgrade_done(upgrade_name) {
    var earned_gxp = guild_db({ Upgrade: upgrade_name }).first().Exp_earned;
    var icon_elem = $(".material[data-upgrade-name='" + upgrade_name + "']").parent().find(".done > .glyphicon");
    // var icon_elem = $(this).find(".glyphicon");
    if (icon_elem.hasClass("glyphicon-remove")) {
        // Gain GXP
        gxp += earned_gxp;
        // Change icon to done
        icon_elem.removeClass("glyphicon-remove");
        icon_elem.addClass("glyphicon-ok");
        // update TAFFYDB
        guild_db({ Upgrade: upgrade_name }).update({ Done: 1 });
    } else {
        // Remove GXP
        gxp -= earned_gxp;
        // Change icon to done
        icon_elem.removeClass("glyphicon-ok");
        icon_elem.addClass("glyphicon-remove");
        // update TAFFYDB
        guild_db({ Upgrade: upgrade_name }).update({ Done: 0 });
    }

    update_gxp_bar();
    // Refresh Material List

    // Update Ready State
    update_upgrade_ready();
    update_upgrade_row_color();
    update_upgrade_material_opacity();

    update_material_need();
    update_material_row_color();
}

function upgrade_done_click(event) {
    var upgrade_name = event.data.upgrade_name;
    upgrade_done(upgrade_name);
}

function update_upgrade_row_color() {
    $("#upgrade_list > tbody > tr").each(function () {
        var ready_icon_elem = $(this).find(".ready > .glyphicon");
        var done_icon_elem = $(this).find(".done > .glyphicon");

        $(this).removeClass();
        // check done
        if (done_icon_elem.hasClass("glyphicon-ok")) {
            $(this).addClass("success");
        } else {
            // check ready
            if (ready_icon_elem.hasClass("glyphicon-ok")) {
                $(this).addClass("info");
            } else if (ready_icon_elem.hasClass("glyphicon-exclamation-sign")) {
                $(this).addClass("warning");
            }
        }
    });
}

function initial_upgrade_list() {
    var header = $("#upgrade_list > thead > tr");
    // Insert header bars
    var header_titles = ["Structure", "Upgrade", "Guild Lv", "Done", "Ready", "GXP", "Aetherium", "Valor", "Gold", "Materials"];
    for (var i in header_titles) {
        header.append("<th>" + header_titles[i] + "</th>");
    }

    // Insert Upgrade List
    var tbody = $("#upgrade_list > tbody");
    var guild_lv = get_guild_lv();
    guild_db().each(function (record, recordnumber) {

        var done = false;
        var ready = false;

        /*
        if (record["Done"] == 1) {
            done = true;
        }
        var ready = (record["LevelRequire"] <= guild_lv);
        */

        html_str = "<tr";
        if (ready && !done) {
            html_str += " class='info'";
        } else if (done) {
            html_str += " class='success'";
        }
        html_str += ">";
        html_str += "<td class='vert-align'>" + record["Structure"] + "</td>";
        html_str += "<td class='vert-align upgrade_name'>" + record["Upgrade"] + "</td>";
        html_str += "<td class='vert-align'>" + record["LevelRequire"] + "</td>";
        if (done) {
            html_str += "<td class='done vert-align'><span class='glyphicon glyphicon-ok' aria-hidden='true'></span></td>";
        } else {
            html_str += "<td class='done vert-align'><span class='glyphicon glyphicon-remove' aria-hidden='true'></span></td>";
        }
        if (ready) {
            html_str += "<td class='ready vert-align'><span class='glyphicon glyphicon-ok' aria-hidden='true'></span></td>";
        } else {
            html_str += "<td class='ready vert-align'><span class='glyphicon glyphicon-remove' aria-hidden='true'></span></td>";
        }
        html_str += "<td class='vert-align'>" + record["Exp_earned"] + "</td>";
        html_str += "<td class='vert-align'>" + record["Aetherium"] + "</td>";
        html_str += "<td class='vert-align'>" + record["Valor"] + "</td>";
        html_str += "<td class='vert-align'>" + record["Gold"] / 10000 + "</td>";
        html_str += "<td class='material' data-upgrade-name='" + record["Upgrade"] + "'></td>";
        html_str += "</tr>";

        // tbody.append(html_str);
        var new_row = $(html_str).appendTo(tbody);
        new_row.find(".done").click({ upgrade_name: record["Upgrade"] }, upgrade_done_click);
    });

    // materials

    var total_materials = [];
    $(".material").each(function () {
        var upgrade = $(this).data("upgrade-name");
        var td_elem = $(this);
        material_db({ Upgrade: upgrade }).order("ItemId").each(function (record, recordnumber) {
            var item_id = record["ItemId"];
            total_materials.push(item_id);

            // insert DOM first, only update src after JSON response
            var item_name = record["ItemName"];
            var wrapper = $("<span class='img_wrapper upgrade_material' data-html='true' data-toggle='tooltip' data-item-id='" + item_id + "'></span>").appendTo(td_elem);
            wrapper.attr("title", item_name);

            var img = new Image();
            img.setAttribute("height", "40");
            img.setAttribute("width", "40");
            img.setAttribute("data-item-id", item_id.toString());
            img.setAttribute("class", "upgrade_material_img");


            wrapper.append(img);
            wrapper.append("<p class='material_img_num'>" + record["ItemQuantity"] + "</p>")
            wrapper.tooltip();
        });
    });

    // update all img srcs
    var ids = $.unique(total_materials).join();
    if (ids != "") {
        $.getJSON("https://api.guildwars2.com/v2/items?ids=" + ids, function (data) {
            for (var index in data) {
                var item = data[index];
                var item_id = item.id;
                var img_src = item.icon;

                $(".upgrade_material_img[data-item-id='" + item_id.toString() + "']").attr("src", img_src);
            }
        });
    }
}

function update_upgrade_material_opacity() {
    $(".upgrade_material").each(function () {
        var item_id = parseInt($(this).data("item-id"));
        var material_had = get_material_had(item_id);
        var material_need = parseInt($(this).find(".material_img_num").text());
        var img_elem = $(this).find("img");
        if ($(this).parent().parent().find(".done > .glyphicon").hasClass("glyphicon-ok")) {
            if (img_elem.hasClass("upgrade_material_not_enough")) {
                img_elem.removeClass("upgrade_material_not_enough");
            }
        } else if (material_had >= material_need && img_elem.hasClass("upgrade_material_not_enough")) {
            img_elem.removeClass("upgrade_material_not_enough");
        } else if (material_had < material_need && img_elem.hasClass("upgrade_material_not_enough") == false) {
            img_elem.addClass("upgrade_material_not_enough");
        }
    });
}

function SortByName(a, b) {
    var aName = a[1].toLowerCase();
    var bName = b[1].toLowerCase();
    return ((aName < bName) ? -1 : ((aName > bName) ? 1 : 0));
}

function initial_material_list() {
    var header = $("#material_list > thead > tr");
    // Insert header bars
    var header_titles = ["Material", "Needed", "Had"];
    for (var i in header_titles) {
        header.append("<th>" + header_titles[i] + "</th>");
    }

    // Insert all materials
    var material_array = material_db().distinct("ItemId", "ItemName").sort(SortByName);
    // get all material ids
    var ids = "";
    $.each(material_array, function (index, value) {
        // insert all rows first
        // (IF you insert rows in JSON response, it will cause bug at update_material_needed function)
        ids += value[0].toString() + ",";

        var tr_elem = $("<tr class='material_row' data-item-id='" + value[0].toString() + "'></tr>").appendTo($("#material_list > tbody"));
        tr_elem.append("<td class='material_name'></td><td class='needed'>0</td><td><input type='number' min='0' value='0' class='had' /></td>");
    });
    // get material data through JSON
    if (ids != "") {
        $.getJSON("https://api.guildwars2.com/v2/items?ids=" + ids, function (data) {
            for (var index in data) {
                var item = data[index];

                var img = new Image();
                var item_id = item.id;
                var item_name = item.name;
                img.setAttribute("height", "40");
                img.src = item.icon;

                // insert into material lists
                var tr_elem = $("tr[data-item-id='" + item_id.toString() + "']");
                tr_elem.find(".material_name").append(img).append(item_name);
            }
        });
    }

    // append on change event to had class
    $(".had").change(material_had_change);
}

// 0 = undone, 1 = ready, 2 = want
var material_show_setting = 0;

function update_material_need() {
    // clear all needed to 0
    $(".needed").text("0");

    var material_needed = {};

    if (material_show_setting == 0) {
        // search for every undone upgrades
        $("#upgrade_list > tbody > tr").each(function () {
            var upgrade_name = $(this).find(".upgrade_name").text();
            if (!$(this).find(".done > .glyphicon").hasClass("glyphicon-ok")) {
                material_db({ Upgrade: upgrade_name }).each(function (record, recordnumber) {
                    var item_id = record["ItemId"];
                    var item_quantity = record["ItemQuantity"];

                    if (!(item_id in material_needed)) {
                        material_needed[item_id] = 0;
                    }
                    material_needed[item_id] += item_quantity;
                });
            }
        });
    } else if (material_show_setting == 1) {
        // search for every ready but undone upgrades
        $("#upgrade_list > tbody > tr").each(function () {
            var ready = !$(this).find(".ready > .glyphicon").hasClass("glyphicon-remove");
            var undone = $(this).find(".done > .glyphicon").hasClass("glyphicon-remove");

            if (ready && undone) {
                var upgrade_name = $(this).find(".upgrade_name").text();
                material_db({ Upgrade: upgrade_name }).each(function (record, recordnumber) {
                    var item_id = record["ItemId"];
                    var item_quantity = record["ItemQuantity"];

                    if (!(item_id in material_needed)) {
                        material_needed[item_id] = 0;
                    }
                    material_needed[item_id] += item_quantity;
                });
            }
        });
    }

    // update item_quantity to needed
    $.each(material_needed, function (item_id, item_quantity) {
        $("tr[data-item-id='" + item_id.toString() + "'] > .needed").text(item_quantity.toString());
    });

    // hide those needed is 0

    $(".needed").parent().show();
    $(".needed").filter(function () {
        return $(this).text() == "0";
    }).parent().hide();

    // hide those not fit the search text
    var search_text = $(".material_search").val().trim();
    if (search_text != "") {
        var search_text_array = search_text.toLowerCase().match(/\S+/g);
        $(".material_name").each(function () {
            var material_name_elem = $(this);
            $.each(search_text_array, function (index, value) {
                if (material_name_elem.text().toLowerCase().indexOf(value) < 0) {
                    material_name_elem.parent().hide();
                    return false;
                }
            });
        });
        // $(".material_name:not(:icontains(" + search_text + "))").parent().hide();
    }
}

function get_material_had(item_id) {
    return parseInt($("#material_list > tbody > tr[data-item-id='" + item_id.toString() + "']").find(".had").val()) || 0;
}

function update_material_row_color() {
    $("#material_list > tbody > tr").each(function () {
        $(this).removeClass("info");
        $(this).removeClass("success");
        var needed = parseInt($(this).find(".needed").text());
        var had = parseInt($(this).find(".had").val());

        if (needed > 0) {
            if (needed > had) {
                $(this).addClass("info");
            } else {
                $(this).addClass("success");
            }
        }
    });
}

function material_had_change() {
    update_material_row_color();
    update_upgrade_material_opacity();
    update_upgrade_ready();
    update_upgrade_row_color();
}

function material_option_btn_click() {
    // skip if it is active
    if ($(this).hasClass("btn-primary")) {
        return;
    }

    // change the classes of the option btns
    $(".material_option.btn-primary").removeClass("btn-primary").addClass("btn-default");
    $(this).removeClass("btn-default").addClass("btn-primary");

    if ($(this).text() == "Undone") {
        material_show_setting = 0;
    } else if ($(this).text() == "Ready") {
        material_show_setting = 1;
    } else if ($(this).text() == "Want") {
        material_show_setting = 2;
    }

    update_material_need();
    update_material_row_color();
}

function material_search_input() {
    update_material_need();
}


$(document).ready(function () {
    update_gxp_bar();
    initial_upgrade_list();
    initial_material_list();
    update_upgrade_ready();
    update_upgrade_row_color();
    update_upgrade_material_opacity();

    update_material_need();
    update_material_row_color();

    $(".material_option").click(material_option_btn_click);
    $(".material_search").on("input", material_search_input);

    $("#save_link").click(save_to_localStorage);
    $("#load_link").click(load_from_localStorage);
});