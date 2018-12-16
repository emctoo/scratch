const state = {
  uid: null,
  username: 'me',
  socket: null,
  channels: [],
  presences: {},
  users: {},
}
const getters = {}
const mutations = {}

const actions = {
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
    this.channels[group].on('todos-update', async ({ content }) => {
      console.log(`receive todos messages, uid: ${content.uid}`);
      if (content.uid !== this.uid) this.todos = content.todos;
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
        const [first, ...rest] = info.metas;
        first['id'] = id;
        return first;
      };

      let groupUserList = this.presences[group].list(listBy);
      groupUserList.pop();
      Vue.set(this.users, group, groupUserList);
    })

    this.presences[group].onJoin((id, current, { metas: targets }) => {
      console.dir(targets);
      targets.forEach(joined => console.log(`${joined.username} joins ${group}.`));
    })

    this.presences[group].onLeave((id, current, { metas: targets }) => {
      console.dir(targets);
      targets.forEach(left => console.log(`${left.username} leaves ${group}`));
    })
  },
}

const store = new Vuex.Store({ state, getters, mutations, actions });
export default store;