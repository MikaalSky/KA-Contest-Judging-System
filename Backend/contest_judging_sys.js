/***
 * This file is where all the general purpose, reusable code should go!
***/
/* This function can be used to inject scripts into pages. It returns the created <script> element. */
/* The reason we make it a global function even though it's in the below namespace is because outside JavaScript files might need to use this function after this function loads, but before the namespace is loaded. */
window.includeFunc = function(path) {
    var scriptTag = document.createElement("script");
    scriptTag.src = path;
    document.body.appendChild(scriptTag);
    return scriptTag;
};

window.Contest_Judging_System = (function() {
    /* Function wrapper to create Contest_Judging_System */
    
    /* jQuery and Firebase are both dependencies for this project. If we don't have them, exit the function immediately. */
    /* TODO: If a project dependency doesn't exist, go ahead an inject it. */
    if (!window.jQuery || !window.Firebase || !window.KA_API) {
        console.log("Needs jQuery, Firebase, and KA_API");
        return;
    }

    /* Everything from this namespace will be placed in the object that is returned. */
    return {
        /* Puts the script injection function inside of this namespace. */
        include: includeFunc,
        /* This function gets all the "Rubrics" that we've defined in Firebase. */
        getRubrics: function(callback) {
            /* Connect to our Firebase app. */
            var firebaseRef = new Firebase("https://contest-judging-sys.firebaseio.com/");

            /* We're going to messing around with the data in our "rubrics" object. Let's go ahead and grab that "child". */
            var fbRubrics = firebaseRef.child("rubrics");

            /* This array will hold all of the Rubrics that we've defined in our array. */
            var rubrics = { };

            /* Query all the data from Firebase, and push the JSON keys into our array. */
            fbRubrics.orderByKey().on("child_added", function(responseData) {
                rubrics[responseData.key()] = responseData.val();
            });

            /* Once all our data has been loaded from Firebase, invoke our callback. */
            fbRubrics.once("value", function() {
                callback(rubrics);
            });
        },
        /* This function gets all the contests that we have stored on Firebase and passes them into a callback function. */
        getStoredContests: function(callback) {
            /* This is the object for the contests within our Firebase database. */
            var fbRef = new Firebase("https://contest-judging-sys.firebaseio.com/contests/");
            /* This is an object to hold all of the data from Firebase. */
            var fromFirebase = {};
            
            /* Template fromFirebase for testing: */
            /*fromFirebase[4955067011694592] = {
                id: 4955067011694592,
                name: "Contest: Comic Strip",
                img: "/computer-programming/contest-comic-strip/4955067011694592/5724160613416960.png"
            };
            fromFirebase[5829785948389376] = {
                id: 5829785948389376,
                name: "Contest: Emoji Maker",
                img: "/computer-programming/contest-emoji-maker/5829785948389376/5668600916475904.png"
            };
            callback(fromFirebase);
            return;*/
            
            /* Insert all of the entries in our database in order by key */
            fbRef.orderByKey().on("child_added", function(item) {
                fromFirebase[item.key()] = item.val();
            });
            /* Finally, pass fromFirebase into callback. */
            fbRef.once("value", function(data) {
                callback(fromFirebase);
            });
        },
        /* Load a specific contest entry, based on ID */
        loadEntry: function(contestId, entryId, callback) {
            var firebaseRef = new Firebase("https://contest-judging-sys.firebaseio.com/contests/" + contestId + "/entries/");

            firebaseRef.orderByKey().equalTo(entryId).on("child_added", function(entryData) {
                callback(entryData.val());
            });
        },
        /* Loads a specific contest from Firebase. */
        loadContest: function(contestId, callback) {
            /* Connect to our Firebase app */
            var firebaseRef = new Firebase("https://contest-judging-sys.firebaseio.com/");
            /* Since we're only going to be dealing with contests in this function, go ahead and create a reference to the "contests" "child". */
            var contestsRef = firebaseRef.child("contests");
            
            contestsRef.orderByChild("id").equalTo(contestId).on("child_added", function(contestData) {
                callback(contestData.val());
            });
        },
        /* Gets N random entries (where N is the number of contests to get) and passes them into a callback. */
        get_N_Entries: function(n, contestId, callback) {
            /* This bool is true iff we're done picking the n entries. */
            var done = false;
            /* This JSON object stores each of the entries we've picked out to display to the judge */
            var pickedEntries = { };

            /* This variable is used to store the number of entries for this contest. */
            var numberOfEntries = 0;

            Contest_Judging_System.loadContest(contestId, function(contestData) {

                /* Declare a variable to hold an array of keys for entries */
                var entriesKeys = Object.keys(contestData.entries);
                /* These are the number of entries we will turn. We will turn either n entries or all of the entriess if there are less than n. */
                var numEntries = (entriesKeys.length < n) ? entriesKeys.length : n;

                /* An array to store the keys that we've already picked */
                var pickedKeys = [ ];

                /* While we still need keys to return... */
                while (pickedKeys.length < numEntries) {
                    /* Pick a random index */
                    var randIndex = Math.floor( Math.random() * entriesKeys.length );

                    /* Get the key from the index that we picked */
                    var pickedKey = entriesKeys[randIndex];

                    /* If we haven't already picked that key... */
                    if (pickedKeys.indexOf(pickedKey) === -1) {
                        /* ...pick it. */
                        pickedEntries[pickedKey] = contestData.entries[pickedKey];
                        pickedKeys.push(pickedKey);
                    }
                }
                    
                /* Tell the below setInterval() that we're done when we're done. */
                done = true;
            });

            /* Check if we're done every second and when we are, call the callback and stop checking if we're done. */
            var finishedInterval = setInterval(function() {
                if (done) {
                    clearInterval(finishedInterval);
                    callback(pickedEntries);
                }
            }, 1000);
        },
        sync: function(callback) {
            /*
             * sync() just fetches the latest data from Khan Academy and Firebase, and compares it.
             * We have two arrays of data; kaData and fbData. We get the data using the KA_API and the above getStoredContests() method.
             * Once both requests have finished, we set fbData to kaData using the Firebase set() method.
             * Originally authored by Gigabyte Giant
             * TODO: Perform added/deleted checking on contest entries.
             * TODO: Actually do something with fbData
             */
            /* These two Booleans check whether or not both requests have been completed. */
            var completed = {
                firebase: false,
                khanacademy: false
            };
            /* Currently not used. Might be re-implemented in the future. */
            /* var addedContests = [];
            var removedContests = []; */
            /* Our two arrays of data */
            var kaData;
            var fbData;

            /* Get all of the contests from Khan Academy */
            KA_API.getContests(function(response) {
                /* When done, set kaData to the contests and set completed.khanacademy to true. */
                kaData = response;
                completed.khanacademy = true;
            });
            /* Get all of the known contests from Firebase */
            this.getStoredContests(function(response) {
                /* When done, set fbData to our stored contests and set completed.firebase to true. */
                fbData = response;
                completed.firebase = true;
            });

            /* Create a new reference to Firebase to use later on when pushing contests to Firebase. */
            var fbRef = new Firebase("https://contest-judging-sys.firebaseio.com/contests/");
            /* Every second, we check if both requests have been completed and if they have, we stop checking if both requests have been completed and set fbRef to kaData using the Firebase set() method. */
            var recievedData = setInterval(function() {
                if (completed.firebase && completed.khanacademy) {
                    clearInterval(recievedData);

                    /* The following objects are used for our "diff" checking */
                    var toAddToFirebase = { };
                    var toRemoveFromFirebase = { };
                    var entriesToAdd = { };
                    var entriesToRemove = { };

                    /* Loop through all the data we recieved from Khan Academy; and see if we already have it in Firebase. */
                    for (var i in kaData) {
                        if (!fbData.hasOwnProperty(i)) {
                            // Most likely a new contest; add it to Firebase!
                            console.log("We found a new contest! Contest ID: " + i);
                            toAddToFirebase[i] = kaData[i];
                        } else {
                            // We have this contest in Firebase; so now let's see if we have all the entries
                            for (var j in kaData[i].entries) {
                                if (!fbData[i].entries.hasOwnProperty(j)) {
                                    // New entry! Add to Firebase.
                                    console.log("We found a new entry! Contest ID: " + i + ". Entry ID: " + j);
                                    /* TODO */
                                    if (!entriesToAdd.hasOwnProperty(i)) {
                                        entriesToAdd[i] = [];
                                        entriesToAdd[i].push( kaData[i].entries[j] );
                                    } else {
                                        entriesToAdd[i].push( kaData[i].entries[j] );
                                    }
                                }
                            }
                        }
                    }
                    console.log(entriesToAdd);
                    /* Loop through all the data we recieved from Firebase; and see if it still exists on Khan Academy. */
                    for (var i in fbData) {
                        if (!kaData.hasOwnProperty(i)) {
                            // Contest removed. Delete from Firebase
                            console.log("We found a contest that no longer exists. ID: " + i);
                            toRemoveFromFirebase[i] = fbData[i];
                        } else {
                            // Contest still exists. Now let's see if any entries have been removed.
                            for (var j in fbData[i].entries) {
                                if (!kaData[i].entries.hasOwnProperty(j)) {
                                    // Entry no longer exists on Khan Academy; delete from Firebase (or mark as archived).
                                    console.log("We found an entry that doesn't exist anymore! Contest ID: " + i + ". Entry ID: " + j);
                                    /* TODO */
                                    if (!entriesToRemove.hasOwnProperty(i)) {
                                        entriesToRemove[i] = [];
                                        entriesToRemove[i].push(j);
                                    } else {
                                        entriesToRemove[i].push(j);
                                    }
                                }
                            }
                        }
                    }

                    /* Add what we don't have; and remove what Khan Academy *doesn't* have. */
                    for (var a in toAddToFirebase) {
                        // Add to Firebase!
                        fbRef.child(a).set(toAddToFirebase[a]);
                    }
                    for (var r in toRemoveFromFirebase) {
                        // Remove from Firebase!
                        fbRef.child(r).set(null);
                    }
                    for (var ea in entriesToAdd) {
                        /* Add all the new entries to Firebase */
                        for (var i = 0; i < entriesToAdd[ea].length; i++) {
                            console.log("Adding " + entriesToAdd[ea][i].id + " to Firebase.");
                            fbRef.child(ea).child("entries").child(entriesToAdd[ea][i].id).set(entriesToAdd[ea][i]);
                        }
                    }
                    for (var er in entriesToRemove) {
                        /* Remove all the old entries from Firebase */
                        for (var i = 0; i < entriesToRemove[er].length; i++) {
                            console.log("Removing " + entriesToRemove[er][i] + " from Firebase!");
                            fbRef.child(er).child("entries").child(entriesToRemove[er][i]).set(null);
                        }
                    }

                    console.log("Sync Completed");
                    callback(kaData);
                }
            }, 1000);
        },
        /* Cookie functions provided by w3schools */
        getCookie: function(cookie) {
            /* Get the cookie with name cookie (return "" if non-existent) */
            var name = cookie + "=";
            /* Check all of the cookies and try to find the one containing name. */
            var cookieList = document.cookie.split(';');
            for (var i = 0; i < cookieList.length; i++) {
                var curCookie = cookieList[i];
                while (curCookie[0] == ' ') curCookie = curCookie.substring(1);
                /* If we've found the right cookie, return its value. */
                if (curCookie.indexOf(name) == 0) return curCookie.substring(name.length, curCookie.length);
            }
            /* Otherwise, if the cookie doesn't exist, return "" */
            return "";
        },
        setCookie: function(cookie, value) {
            /* Set a cookie with name cookie and value cookie that will expire 30 days from now. */
            var d = new Date();
            d.setTime(d.getTime() + (30*24*60*60*1000));
            var expires = "expires="+d.toUTCString();
            document.cookie = cookie + "=" + value + "; " + expires;
        },
        tryAuthentication: function(callback) {
            /* Attempts authentication and passes a Bool (true iff authentication worked) to callback */
            
            console.log("tryAuthentication invoked!");
            /* Get Firebase data */
            var firebaseRef = new Firebase("https://contest-judging-sys.firebaseio.com/");
            var judges = firebaseRef.child("loggedInJudges");
            var allowed = firebaseRef.child("allowedJudges");

            /* Access the Firebase ref with Google Auth validation as a popup. */
            firebaseRef.authWithOAuthPopup("google", function(error, authData) {
                if (error) {
                    /* Log errors in dev console */
                    console.log(error);
                } else {
                    /* Set authId and uid cookies */
                    Contest_Judging_System.setCookie("authId", authData.google.accessToken);
                    Contest_Judging_System.setCookie("uid", authData.uid);
                    /* Set authData in database using uid */
                    judges.child(authData.uid).set(authData);

                    /* Use allowed to set allowedJudges */
                    var allowedJudges = {};
                    allowed.orderByKey().on("child_added", function(snapshot) {
                        allowedJudges[snapshot.key()] = snapshot.val();
                    });

                    /* Once all of the allowedJudges have been added... */
                    allowed.once("value", function(data) {
                        /* Loop through allowedJudges and if any of them are allowed, log "Access granted!", pass true to callback and exit the function. */
                        for (var i in allowedJudges) {
                            if (allowedJudges[i].uid === Contest_Judging_System.getCookie("uid")) {
                                console.log("Access granted!");
                                callback(true);
                                return;
                            }
                        }
                        /* If we haven't exited, then this judge is not authenticated, so we pass false to callback. */
                        callback(false);
                    });
                }
            });
        },
        isJudgeAllowed: function(uid, callback) {
            /* Check if the judge with id of uid is allowed and then call callback with the Bool that is true iff such is true. */

            /* Get the Firebase data */
            var fbRef = new Firebase("https://contest-judging-sys.firebaseio.com");
            var allowedJudges = fbRef.child("allowedJudges");
            /* All allowed judges as JSON */
            var allAllowedJudges = { };
            /* True iff we've finished */
            var done = false;
            /* True iff uid is valid */
            var valid = false;
            
            /* Add in allowedJudges using Firebase */
            allowedJudges.orderByKey().on("child_added", function(data) {
                allAllowedJudges[data.key()] = data.val();
            });

            /* Once all of the allAllowedJudges have been added... */
            allowedJudges.once("value", function() {
                /* If the uid is valid, set valid and done to true.
                for (var i in allAllowedJudges) {
                    if (allAllowedJudges[i].uid == uid && allAllowedJudges[i].allowed == true) {
                        valid = true;
                        done = true;
                    }
                }
                /* At this point, valid has been set correctly, so we keep valid as it is (false or true) and simply set done to true. */
                done = true;
            });

            /* Check if we're done every second and if we are, stop checking if we're true and pass callback into valid. */
            var returnWait = setInterval(function() {
                if (done) {
                    clearInterval(returnWait);
                    callback(valid);
                }
            }, 1000);
        },
        addAllowedJudge: function(uid) {
            /* This adds a judge with id of uid into the allowedJudges. */
            var firebaseRef = new Firebase("https://contest-judging-sys.firebaseio.com");
            var allowedJudges = firebaseRef.child("allowedJudges");
            allowedJudges.push().set({uid: uid, allowed: true});
        },
        judgeEntry: function(contest, entry, scoreData, authToken, callback) {
            /* This judges an entry entry of contest with scoreData from a judge with id as set in cookies. */
            /* TODO: Figure out what to do with authToken. */
            /* TODO: Figure out what to do with callback. */

            /* Get Firebase data */
            var fbContestRef = new Firebase("https://contest-judging-sys.firebaseio.com/contests/" + contest);
            /* All entries of this contest */
            var entries = fbContestRef.child("entries");

            /* Load the Firebase data of this entry of this contest and then... */
            Contest_Judging_System.loadEntry(contest, entry, function(entryData) {
                /* Get all of the rubrics from Firebase */
                /* NOTE: What's the point of calling getRubrics() if we're not using allRubrics? */
                /* TODO: Figure out what to do with allRubrics */
                Contest_Judging_System.getRubrics(function(allRubrics) {
                    /* Get the current rubric score */
                    var currentRubricScore = entryData.scores.rubric;
                    /* Get the new number of judges by adding the number of judges by 1 */
                    var newNumberOfJudges = parseInt(entryData.scores.rubric.NumberOfJudges, 10)+1;
                    /* Find the judges who voted (or an empty array if noone voted yet) */
                    var judgesWhoVoted = entryData.scores.rubric.judgesWhoVoted === undefined ? [] : entryData.scores.rubric.judgesWhoVoted;

                    /* If this judge hasn't voted on this entry yet... */
                    if (judgesWhoVoted.indexOf(Contest_Judging_System.getCookie("uid")) === -1) {
                        /* Push the uid of this judge into judgesWhoVoted */
                        /* NOTE: We never actually use judgesWhoVoted to set Firebase data anywhere. This way, can't judges still vote multiple times? */
                        judgesWhoVoted.push(Contest_Judging_System.getCookie("uid"));
                        
                        /* Create a new object for storing scores */
                        var newScoreObj = {
                            "Level": {
                                "rough": entryData.scores.rubric.Level.rough + scoreData.Level,
                                "avg": Math.round((parseInt(entryData.scores.rubric.Level.rough, 10) + scoreData.Level) / newNumberOfJudges)
                            },
                            "Clean_Code": {
                                "rough": entryData.scores.rubric.Clean_Code.rough + scoreData.Clean_Code,
                                "avg": (parseInt(entryData.scores.rubric.Clean_Code.rough, 10) + scoreData.Clean_Code) / newNumberOfJudges
                            },
                            "Creativity": {
                                "rough": entryData.scores.rubric.Creativity.rough + scoreData.Creativity,
                                "avg": (parseInt(entryData.scores.rubric.Creativity.rough, 10) + scoreData.Creativity) / newNumberOfJudges
                            },
                            "Overall": {
                                "rough": entryData.scores.rubric.Overall.rough + scoreData.Overall,
                                "avg": (parseInt(entryData.scores.rubric.Overall.rough, 10) + scoreData.Overall) / newNumberOfJudges
                            },
                            "NumberOfJudges": parseInt(newNumberOfJudges, 10),
                            "judgesWhoVoted": judgesWhoVoted
                        };

                        /* Set the new scores to newScoreObj */
                        var thisEntry = new Firebase("https://contest-judging-sys.firebaseio.com/contests/" + contest + "/entries/" + entry + "/scores/");
                        thisEntry.child("rubric").set(newScoreObj);
                        /* Reload the page now that we're done. */
                        window.location.reload();
                    }
                    /* If this judge has already judged this entry, tell them that they've already done so. */
                    else {
                        alert("You've already judged this entry!");
                    }
                });
            });
        }
    };
})();