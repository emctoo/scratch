import { Socket, Presence } from './phoenix.js';

const filters = {
	all: (todos) => todos,
	active: (todos) => todos.filter((todo) => !todo.completed),
	completed: (todos) => todos.filter((todo) => todo.completed)
};

window.$vue = new Vue({
	el: '.todoapp',

	data: {
		todos: [], // {id, title, completed}[]
		newTodo: '',
		editedTodo: null,
		visibility: 'all',
		uid: null,
		username: null,
		socket: null,
		channels: [],
		presences: {},
		users: {},
	},

	async mounted() {
		let { data } = await axios.post('/api/login');

		this.uid = data.payload.uid;
		this.username = data.payload.username;

		console.log(`authed, uid: ${this.uid}, username: ${this.username}`);

		console.log(`socket 创建 ..`);
		await this.openSocket(this.uid, this.username);

		this.todos = (await axios.get('/api/todos')).data.payload;
	},

	// watch todos change for localStorage persistence
	watch: {
		todos: {
			deep: true,
			handler: async function (values, previousValue) {
				console.log(`todos updated`);
				console.dir(values);

				// todo: 有不同才发请求，或者在服务器做
				await axios.post('/api/todos', { uid: this.uid, todos: values });
			}
		}
	},

	// computed properties
	// http://vuejs.org/guide/computed.html
	computed: {
		filteredTodos() {
			return filters[this.visibility](this.todos);
		},
		remaining() {
			return filters.active(this.todos).length;
		},
		allDone: {
			get() {
				return this.remaining === 0;
			},
			set(value) {
				this.todos.forEach((todo) => todo.completed = value);
			}
		}
	},

	// methods that implement data logic.
	// note there's no DOM manipulation here at all.
	methods: {

		pluralize(word, count) {
			return word + (count === 1 ? '' : 's');
		},

		addTodo() {
			var value = this.newTodo && this.newTodo.trim();
			if (!value) return;

			let id = this.todos.length === 0 ? 0 : this.todos[this.todos.length - 1].id + 1;
			this.todos.push({ id, title: value, completed: false });

			this.newTodo = '';
		},

		removeTodo(todo) {
			var index = this.todos.indexOf(todo);
			this.todos.splice(index, 1);
		},

		editTodo(todo) {
			this.beforeEditCache = todo.title;
			this.editedTodo = todo;
		},

		doneEdit(todo) {
			if (!this.editedTodo) {
				return;
			}
			this.editedTodo = null;
			todo.title = todo.title.trim();
			if (!todo.title) {
				this.removeTodo(todo);
			}
		},

		cancelEdit(todo) {
			this.editedTodo = null;
			todo.title = this.beforeEditCache;
		},

		removeCompleted() {
			this.todos = filters.active(this.todos);
		},

		async openSocket(uid, username) {
			return await (
				new Promise((resolve, reject) => {
					// const url = `ws://${location.host.split(':')[0]}:4000/event-bus`;
					const url = `ws://${location.host}/event-bus`;
					const params = { uid, username };
					const logger = (kind, message, data) => {
						// if (message === ' group:lobby time ') return;
						// if (message === ' group:lobby qrcode ') return;
						// console.log(`kind: [${kind}], message: [${message}]`)
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

		async commitTodosChange(todo, op) {
			await axios.post('/api/todos', { 'todos': this.todos, 'change': todo, op });
		}
	},

	// a custom directive to wait for the DOM to be updated before focusing on the input field.
	// http://vuejs.org/guide/custom-directive.html
	directives: {
		'todo-focus'(el, binding) {
			if (binding.value) el.focus();
		}
	}
});
