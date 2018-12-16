#!/usr/bin/env python
# coding=utf-8

import sanic
from sanic import response
import logging
import random, hashlib
import requests
import psycopg2

PG_DSN = 'host=localhost port=5432 username=maple password=maple dbname=channeld_dev'

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')

app = sanic.Sanic()

app.config['event-bus-host'] = 'localhost:4000'
app.config['users'] = []
app.config['todos'] = []


@app.post('/api/login')
async def auth(req):
    f = lambda: hashlib.md5(str(random.random()).encode('utf-8')).hexdigest()[:4]
    last_id = app.config['users'][-1]['uid'] + 1 if app.config['users'] else 1

    user = {'username': f(), 'uid': last_id}
    app.config['users'].append(user)

    return response.json({'success': True, 'payload': user})


@app.get('/api/logout')
async def logout(req):
    return response.json({'success': True, 'payload': None})


@app.get('/api/todos')
async def list_dotos(req):
    return response.json({'success': True, 'payload': app.config['todos']})


def different(values, oldValues):
    if len(values) != len(oldValues):
        return True

    valuesDict = {value['id']: value for value in values}
    oldValuesDict = {value['id']: value for value in oldValues}

    if set(valuesDict.keys()) - set(oldValuesDict.keys()):
        return True

    for key, value in valuesDict.items():
        oldValue = oldValuesDict[key]
        if value['title'] != oldValue['title'] or value['completed'] != oldValue['completed']:
            return True

    return False


@app.post('/api/todos')
async def update_todos(req):
    if not req.json['todos']:
        return response.json({'success': False, 'payload': 'no change'})

    uid, todos = req.json['uid'], req.json['todos']
    have_different = different(todos, app.config['todos'])

    if have_different is False:
        return response.json({'success': False, 'payload': 'no diff'})

    app.config['todos'] = todos

    payload = {'topic': 'group:system', 'event': 'todos-update', 'message': req.json}
    resp = requests.post(f'http://{app.config["event-bus-host"]}/api/event/todos', json=payload)
    if resp.status_code != 200:
        logging.info('event-bus broadcasting error')
        return response.json({'success': False, 'payload': 'notification error'})

    return response.json({'success': True, 'payload': None})


if __name__ == "__main__":
    app.run(host='0.0.0.0', port=8001, debug=True)
