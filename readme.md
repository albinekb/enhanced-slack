## 🌴 Slack enhanced

<img src="https://cloud.githubusercontent.com/assets/5027156/22395440/8287667e-e53e-11e6-8780-bc5b227ab52d.png" width="361">

This is a proof of concept, to test the idea of injecting code into Slack.app.

Current features:
- Syntax highlight using [highlight.js](https://highlightjs.org)
- Double click to edit message

Next up:
- Hot code reloading (no need to restart Slack.app)
- Plugins (inject your own styles/js)
- Documentation

Feel free to PR/open an issue with suggestions/beautifications! 👌

### Installing
```sh
$ git clone git@github.com:albinekb/enhanced-slack.git
$ cd enhanced-slack
$ yarn
$ yarn run inject
```

Restart slack, you should now see syntax highlighting 💅

#### Uninstalling
```sh
$ yarn run eject
```
