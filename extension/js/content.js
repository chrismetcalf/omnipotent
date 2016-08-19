function search(query) {
  return jQuery.ajax({
    dataType: "json",
    url: "https://127.0.0.1:9201/tasks/_search?q=" + query
  });
}

InboxSDK.load('1', 'sdk_omnipotent_e327680648').then(function(sdk){
  // // the SDK has been loaded, now do something with it!
  // sdk.Compose.registerComposeViewHandler(function(composeView){
  //   // a compose view has come into existence, do something with it!
  //   composeView.addButton({
  //     title: "My Nifty Button!",
  //     iconUrl: 'https://lh5.googleusercontent.com/itq66nh65lfCick8cJ-OPuqZ8OUDTIxjCc25dkc4WUT1JG8XG3z6-eboCu63_uDXSqMnLRdlvQ=s128-h128-e365',
  //     onClick: function(event) {
  //       event.composeView.insertTextIntoBodyAtCursor('Hello World!');
  //     },
  //   });
  // });

  // Add labels for mails that have outstanding tasks
  sdk.Lists.registerThreadRowViewHandler(function(thread_row) {
    search(thread_row.getThreadID() + " AND completed:false")
      .done(function(response) {
        var waiting = 0;
        var tasks = 0;
        // Yeah, I know this is kind of silly.
        var min_due = 100000000;
        var min_deferred = null;

        $.each(response.hits.hits, function(idx, hit) {
          // What kind of task is it?
          if(hit._source.context.length > 0 && hit._source.context[0]["name"] == "Waiting For") {
            waiting += 1;
          } else {
            tasks += 1;
          }

          // Anything due soon?
          if(hit._source.due_date != null) {
            var delta = (new Date(hit._source.due_date * 1000) - Date.now())/1000/60/60;
            if(delta < min_due) {
              min_due = delta;
            }
          }

          // Deferred?
          if(hit._source.defer_date != null) {
            var deferred = new Date(hit._source.defer_date * 1000);
            if(min_deferred == null || deferred < min_deferred) {
              min_deferred = deferred;
            }
          }
        });

        // Add Labels
        if(waiting) {
          thread_row.addLabel({
            title: "Waiting For" + (waiting > 1 ? " (x" + waiting + ")" : ""),
            backgroundColor: "#0074D9",
            foregroundColor: "#FFFFFF"
          });
        }
        if(tasks) {
          thread_row.addLabel({
            title: "Active Task" + (waiting > 1 ? " (x" + waiting + ")" : ""),
            backgroundColor: "#2ECC40",
            foregroundColor: "#FFFFFF"
          });
        }

        // Due Labels
        if(min_due < 0) {
          // Overdue
          thread_row.addLabel({
            title: "Overdue!",
            backgroundColor: "#FF4136",
            foregroundColor: "#FFFFFF"
          });
        } else if(min_due < 24) {
          // Due Soon
          thread_row.addLabel({
            title: "Due Soon",
            backgroundColor: "#FF851B",
            foregroundColor: "#FFFFFF"
          });
        }

        // Deferred
        if(min_deferred) {
          thread_row.addLabel({
            title: "Deferred (" + min_deferred.toISOString().replace(/T.*$/, "") + ")",
            backgroundColor: "#AAAAAA",
            foregroundColor: "#FFFFFF"
          });
        }
      });
  });

  // Check to see if this thread has outstanding tasks
  sdk.Conversations.registerThreadViewHandler(function(thread_view) {
    var thread_id = thread_view.getThreadID();

    // Look him up!
    search(thread_id + " AND completed:false")
      .done(function(response) {
        var list = null;
        jQuery.each(response.hits.hits, function(idx, hit) {
          if(list == null) {
            list = document.createElement('ul');
          }

          var context = hit._source.context[0];
          var project = hit._source.project;

          jQuery(list).append('<li>'
              + '<em><a class="omni" href="#" data-url="' + hit._source.uri + '">' + hit._source.name + '</a></em> '
              + (context ? '(<a class="omni" href="#" data-url="' + context.uri + '">' + context.name + '</a>) ' : '')
              + (project ? '[<a class="omni" href="#" data-url="' + project.uri + '">' + project.name + '</a>] ' : '')
              + '</li>');
          jQuery(list).find(".omni").click(function(e) {
            e.preventDefault();
            var popout = window.open(jQuery(this).attr("data-url"));
            window.setTimeout(function() {
              popout.close();
            }, 500);
          });
        });

        if(list != null) {
          // Add our sidebar with content
          thread_view.addSidebarContentPanel({
            title: "Matching OmniFocus Tasks",
            el: list,
            iconUrl: chrome.runtime.getURL('images/thumbnail.png')
          });
        }
      });
  });

  // Button and shortcut key for creating a task off of the current view
  sdk.Toolbars.registerToolbarButtonForThreadView({
    title: "New Task",
    iconUrl: chrome.runtime.getURL('images/thumbnail.png'),
    // section: SectionNames.METADATA_STATE,
    section: 1,
    keyboardShortcutHandle: sdk.Keyboard.createShortcutHandle({
      chord: "t",
      description: "Create new task in OmniFocus"
    }),
    onClick: function(event) {
      console.log(event);
    }
  });
});
