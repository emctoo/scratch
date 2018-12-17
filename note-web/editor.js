import store from './store.js';
import { Socket, Presence } from './phoenix.js';

Quill.register('modules/cursors', QuillCursors);
Quill.import('modules/cursors');

window.$vm = new Vue({
  el: '#app',
  store,
  data() {
    return {
      message: '请开始你的表演！',

      content: '<h2>Hello, world!</h2>',
      quill: null,
      editorOption: {
        theme: 'snow',
        modules: {
          syntax: true,
          toolbar: '#toolbar-container',
          cursors: true
        },
      },
      cursors: null,

      uid: 0,
      username: 'anonymous',
      socket: null,
      defaultGroup: 'group:system',
      channels: [],
      presences: {},
      groupUsers: {},
    }
  },

  components: {
  },

  async mounted() {
    let { data } = await axios.post('/api/login');

    this.uid = data.payload.uid;
    this.username = data.payload.username;

    console.log(`authed, uid: ${this.uid}, username: ${this.username}`);

    console.log(`socket 创建 ..`);
    await this.openSocket(this.uid, this.username);

    this.quill = new Quill('#editor', this.editorOption);

    // init content
    (await axios.get('/api/note/0')).data.payload.forEach(delta => this.quill.updateContents(delta, 'silent'));

    this.cursors = this.quill.getModule('cursors');

    this.quill.on('text-change', this.textChange);
    this.quill.on('selection-change', this.selectionChange);
    console.log('this is quill A instance object', this.quill);
  },

  methods: {
    textChange(delta, previousDelta, source) {
      this.channels[this.defaultGroup].push('text-change', { delta, previousDelta, source })
      this.channels[this.defaultGroup].push('selection-change', { range: this.quill.getSelection(), previousRange: null, source })
    },

    selectionChange(range, previousRange, source) { // range: {index, length}
      this.channels[this.defaultGroup].push('selection-change', { range, previousRange, source })
    },

    applyDelta(delta) {
      this.quill.updateContents(delta, 'silent');
    },

    applyCursor(uid, username, range, color = '#f00') {
      this.cursors.setCursor(uid, range, username, color);
    },

    async openSocket(uid, username) {
      return await (
        new Promise((resolve, reject) => {
          const url = `ws://${location.host}/event-bus`;
          const params = { uid, username };
          const logger = (kind, message, data) => {
            // console.log(`${kind} ${message}`, data);
          };

          this.socket = new Socket(url, { params, logger, username })

          this.socket.onOpen(() => {
            console.log('socket connected');
            this.openSystemChannel();
          }); // 所有的都要join到system

          this.socket.onClose((ev) => { console.log('socket closed') });
          this.socket.onError((ev) => { console.log(`socket error happends, ${ev}`) });

          console.log('socket connecting ...')
          this.socket.connect();

          resolve();
        })
      )
    },

    openSystemChannel() {
      let group = 'group:system';

      Vue.set(this.channels, group, this.socket.channel(group, { uid: this.uid, username: this.username }));
      this.channels[group].onError((err) => { console.log(`join group ${group}, error: ${err}`) });
      this.channels[group].onClose((ev) => { console.log(`group ${group} closed, ${ev}`) });

      this.channels[group].join()
        .receive('error', (err) => { console.log(`join group ${group}, error: ${err}`) })
        .receive('ok', () => {
          console.log(`group ${group} joined.`);
          this.trackChannelPresence(group);

          // TODO: 关注的添加presence
        })

      this.channels[group].on('time', (message) => { this.time = message.body.body; });
      this.channels[group].on('text-change', async (message) => {
        if (message.uid !== String(this.uid)) this.applyDelta(message.content.delta);
      });

      this.channels[group].on('selection-change', (message) => {
        if (message.uid !== String(this.uid)) this.applyCursor(message.uid, message.username, message.content.range);
      });
    },

    async closeSystemChannel() {
      let group = 'group:system'
      if (this.groupList.includes(group) === false) return;

      await (
        new Promise((resolve, reject) => {
          this.channels['group:system']
            .leave()
            .receive('ok', () => {
              console.log('%c - leave group:system now.', 'color: red')
              Vue.delete(this.channels, 'group:system')
              resolve()
            })
        })
      )
    },

    trackChannelPresence(group) {
      if (Object.keys(this.presences).includes(group)) {
        console.log(`group ${group} 已经在track presence`);
        return
      }

      Vue.set(this.presences, group, new Presence(this.channels[group], {}));

      this.presences[group].onSync(() => {
        console.log(`同步 ${group} presence 列表 ...`);

        let listBy = (id, info) => {
          if (info.hasOwnProperty('metas') === false) return;
          return info.metas[0];
        };

        let groupUserList = this.presences[group].list(listBy);
        groupUserList.pop();
        Vue.set(this.groupUsers, group, groupUserList);
      })

      this.presences[group].onJoin((id, current, { metas: targets }) => {
        targets.forEach(joined => console.log(`${joined.username} joins ${group}.`));
      })

      this.presences[group].onLeave((id, current, { metas: targets }) => {
        targets.forEach(left => console.log(`${left.username} leaves ${group}`));
      })
    },
  },

  computed: {
    currentUsers() {
      if (this.groupUsers.hasOwnProperty(this.defaultGroup) === false) return [];
      return this.groupUsers[this.defaultGroup].filter(u => this.uid !== parseInt(u.uid));
    }
  }
})