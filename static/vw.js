/*
 * VW - A browser-based, multi-user virtual world
 * 
 * Copyright (c) 2010 Shun-Yun Hu <syhu@yahoo.com>, Ingy döt Net <ingy@ingy.net>
 * Licensed under the MIT License.
 * See the License file.
 */

function XXX() {
    throw("Don't checkin code with XXX!");
    if (typeof(window.console) != 'undefined')
        console.log.apply(this, arguments)
}

Array.prototype.map = function(f) {
    var a = [];
    for (var i = 0, l = this.length; i < l; i++) {
        var e = f.call(this[i]);
        if (typeof(e) != 'undefined') {
            a.push(e);
        }
    }
    return a;
};

Array.prototype.grep = function(f) {
    var a = [];
    for (var i = 0, l = this.length; i < l; i++) {
        if (f.call(this[i])) {
            a.push(this[i]);
        }
    }
    return a;
};

(VW = function(){}).prototype = {

    is_setup: false,
    user_id: String(Math.random()),
    user_email: null,
    state: {
        users: [],
        players: [],
        game: {
            x: 0,
            y: 0
        }
    },
    user_info: {},
    chat_focus: false,

    init: function() {
        this.startLongPoll();
        this.showSigninScreen();
        this.addEventHandlers();
    },

    showSigninScreen: function() {
        var self = this;

        $('input.user_email').val('').focus();
        $('.word_input input').val('');
        $('.chat_input input').val('');

        $('form.signin')
            .unbind('submit')
            .submit(
                function() {
                    var email = $(this).find('input').val();
                    if (email.match(/^[\w\.\-]+@[\w\.\-]+\.\w{2,4}$/)) {
                        self.user_email = email;
                        self.postEvent({event: 'request_state'});
                        $('.signin_screen').hide();
                        $('.chat_messages').height(500);
                        $('table.game_board td')
                            .height(50)
                            .width(50);
                        $('.game_screen').show();
                        setTimeout(function() { $('.chat_input input').focus() }, 250);
                        setTimeout(function() { self.setupFirstUser() }, 1000);
                    }
                    else {
                        $('div.signin_error').text(
                            "'" + email + "' is an invalid email address"
                        );
                    }
                    return false;
                }
            );
        if (window.location.search.match(/email=(.*)/)) {
            var email = RegExp.$1;
            $('form.signin').find('input').val(email).end().submit();
        }
    },

    setupFirstUser: function() {
        if (this.is_setup) return;
        this.addUser(this.user_id, this.user_email);
        this.is_setup = true;
    },

    signOff: function() {
        if (this.is_setup) {
            if (this.getUser(this.user_id).is_player) {
                this.postEvent({
                    event: 'remove_player',
                    player_id: this.user_id
                });
            }
            this.postEvent({event: 'remove_user'});
        }
    },

    addEventHandlers: function() {
        var self = this;

        $('.chat_input')
            .submit(function() {
                var msg = $(this).find('input').val();
                if (msg == '   ') {
                    $('.chat_messages').html('');
                }
                else if (msg.match(/\S/)) {
                    msg = msg.replace(/^\s+/, '')
                        .replace(/\s+$/, '')
                        .replace(/\s+/g, ' ')
                    if (msg.length > 150)
                        msg = msg.substr(0, 150);
                    self.postEvent({
                        event: 'chat_msg',
                        msg: msg
                    });
                }
                $(this).find('input').val('').focus();
                return false;
            });

        $('.chat_input input').blur(function() {
            self.chat_focus = false;
        })
        .focus(function() {
            self.chat_focus = true;
        });

        onunload = function() {
            self.signOff();
            return false;
        }
    },

    isMasterUser: function() {
        return (this.user_id == this.state.users[0].user_id);
    },

    genImageHtml: function(email, id) {
        return '<img src="' +
            'http://www.gravatar.com/avatar/' + $.md5(email) +
            '" alt="' + email +
            '" title="' + email + ' - (' + id +
            ')" />';
    },

    addUser: function(user_id, user_email) {
        var self = this;

        var user = {
            user_id: user_id,
            user_email: user_email
        };
        this.state.users.push(user);
        this.user_info[user_id] = {};
       
        var img_html = this.genImageHtml(user_email, user_id);
        $('.game_pane')
            .append('<div class="cog">' + img_html + '</div>')
    },

    removeUser: function(user_id) {
        var user = this.getUser(user_id);
        if (!user) return;
        var ii = user.user_num;

        this.state.users.splice(ii - 1, 1);
        delete(this.user_info[user_id]);

        $('table.users')
            .find('tr:eq(' + (ii - 1) + ')')
            .remove();
    },

    addPlayer: function(player_id) {
        var self = this;

        var user = this.getUser(player_id);
        if (user.is_player) return;

        var email = user.user_email;
        var html = this.genImageHtml(email, player_id);

        var td = this.user_info[player_id].player_td = $('table.players tr:eq(0)')
            .each(function() {
                $(this).append('<td>' + html + '</td>');
            })
            .find('td:last')[0];

        if (this.isMasterUser()) {
            $(td)
                .click(function() {
                    if (self.state.game.is_playing) return;
                    self.postEvent({
                        event: 'remove_player',
                        player_id: player_id
                    });
                });
        }

        this.state.players.push(player_id);
    
        if (this.isMasterUser() && this.state.players.length >= 2) {
            $('.game_start').show();
        }
    },

    // TODO Remove player from game board
    removePlayer: function(user_id) {
        var user = this.getUser(user_id);
        if (!(user && user.is_player)) return;

        var col = user.player_num;
        $('table.players tr')
            .find('td:eq(' + (col - 1) + ')')
            .remove();
        this.state.players.splice((col - 1), 1);
        delete this.user_info[user_id].player_td;
    },

    getUser: function(user_id) {
        for (var i = 0, l = this.state.users.length; i < l; i++) {
            var user = this.state.users[i];
            if (user.user_id == user_id) {
                user.user_num = i + 1;
                var td = this.user_info[user_id].player_td;
                user.is_player = Boolean(td);
                if (user.is_player) {
                    user.player_num = $(td).prevAll('td').size() + 1;
                }
                return user;
            }
        }
        return null;
    },

// Server communication
    postEvent: function(event) {
        // XXX('Posting event: ' + event.event);
        event.client_id = this.user_id;
        event.user_id = this.user_id;
        event.user_email = this.user_email;
        event.type = 'event';
        $.ajax({
            url: '/games/' + this.room + '/post',
            data: event,
            type: 'post',
            dataType: 'json',
            success: function(r) { }
        });
    },

    startLongPoll: function() {
        var self = this;
        $.ev.handlers.event = function(event) {
            // XXX(event['event'], event.user_id, event);
            var handler = self['handle_' + event['event']];
            if (handler) {
                handler.call(self, event);
            }
        };
        $.ev.loop('/games/' + this.room + '/poll?client_id=' + this.user_id);
    },

// Message handlers
    handle_request_state: function(event) {
        if (this.is_setup &&
            this.state.users[0].user_id == this.user_id
        ) {
            this.postEvent({
                event: 'current_state',
                state: $.toJSON(this.state),
                for_user: event.user_id
            });
        }
    },

    handle_current_state: function(event) {
        if (this.is_setup || event.for_user != this.user_id) return;
        var state = $.evalJSON(event.state);
        for (var i = 0, l = state.users.length; i < l; i++) {
            var user = state.users[i];
            this.addUser(user.user_id, user.user_email);
        }
        for (var i = 0, l = state.players.length; i < l; i++) {
            this.addPlayer(state.players[i]);
        }
        this.is_setup = true;
        this.postEvent({event: 'add_user'});
    },
            

    handle_chat_msg: function(event) {
        var user = this.getUser(event.user_id); 
        if (! user) return;
        var email = user.user_email;
        var id = user.user_id;
        var html = this.genImageHtml(email, id) +
            '&nbsp;<span class="msg"></span><br />';
        $('.chat_messages')
            .prepend(html)
            .find('span:first')
            .text(event.msg);
    },

    handle_add_user: function(event) {
        this.addUser(event.user_id, event.user_email);
    },

    handle_remove_user: function(event) {
        this.removePlayer(event.user_id);
        this.removeUser(event.user_id);
    },

    handle_add_player: function(event) {
        this.addPlayer(event.player_id);
    },

    handle_remove_player: function(event) {
        this.removePlayer(event.player_id);
    },

    handle_start_game: function(event) {
        $('.game_start').hide();
        if (this.isMasterUser())
            $('.game_stop').show();
        $('.word_input').show();
        $('tr.score_row').remove();
        $('table.players tr:gt(0)').remove();
        var $picture_row = $('table.players tr:first');
        var $score_row = $('table.players')
            .prepend('<tr class="score_row"></tr>')
            .find('tr:first');
        $picture_row.find('td').each(function() {
            $score_row.append('<td class="total_score">0</td>');
        });
        this.chat_focus = false;
        setTimeout(function() {
            $('.word_input input').focus();
        }, 1000);

        this.startKeyPress();

        this.state.game.is_playing = true;
    },

    startKeyPress: function() {
        var self = this;
        document.onkeypress = function (e) {
            if (self.chat_focus) return true;
            var key;
            if (e == null) {
                // IE
                key = event.keyCode
            }
            else {
                // Mozilla
                if (e.altKey || e.ctrlKey || e.metaKey) {
                    return true
                }
                key = e.charCode || e.keyCode;
            }
            
            if ( ( key >= 65 && key <= 90 )  || (key >= 97 && key <= 122 ) ) {
                if (key > 90) key -= 32;
                var letter = String.fromCharCode( key );
                var word = $('form.word_input input').val();
                var new_word = word + letter;
                var path = self.checkWord(new_word);
                // XXX('check', new_word, path);
                if (path) {
                    $('form.word_input input').val(new_word);
                    var $cells = $('table.game_board td').css('background-color', '#FFF');
                    for (var i = 0; i < path.length; i++) {
                        $($cells[path[i]]).css('background-color', '#888');
                    }
                }
                else {
                    self.flashInput();
                }
            }
            else if (key == 8) {
                var word = $('form.word_input input').val();
                word = word.substr(0, word.length - 1);
                $('form.word_input input').val(word);
                var $cells = $('table.game_board td').css('background-color', '#FFF');
                if (word.length > 0) {
                    var path = self.checkWord(word);
                    for (var i = 0; i < path.length; i++) {
                        $($cells[path[i]]).css('background-color', '#888');
                    }
                }
            }
            else if (key == 13) {
                var word = $('form.word_input input').val();
                $('form.word_input input').val('');
                var $cells = $('table.game_board td').css('background-color', '#FFF');
                if (word.length < 3 || self.state.game.played[word]) {
                    self.flashInput();
                    return false;
                }
                $.ajax({
                    url: "/word_lookup",
                    data: {word: word},
                    type: 'post',
                    dataType: 'json',
                    success: function(r) {
                        if (r.success) {
                            self.postEvent({
                                event: 'add_word',
                                'word': word
                            });
                        }
                        else {
                            self.flashInput();
                        }
                    }
                });
            }
            else {
                self.goto_number = '';
            }
            return false;
        };
    },

    'The': 'End'
};
