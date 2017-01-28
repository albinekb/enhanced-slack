## 🌴 Enhanced Slack

<img src="https://cloud.githubusercontent.com/assets/5027156/22395478/17fc8a44-e540-11e6-898d-38cbad70ff4e.png" width="581">

This is a proof of concept to test the idea of enhancing Slack.app.

*Current features:*
- [x] Syntax highlight using [highlight.js](https://highlightjs.org)
- [x] Double click to edit message

*Next up:*
- [ ] Hot code reloading (no need to restart Slack.app)
- [ ] Make default features configurable
- [ ] Plugins (inject your own css & js)
- [ ] Documentation

Feel free to PR/open an issue with suggestions/beautifications! 👌

### Install
```sh
git clone git@github.com:albinekb/enhanced-slack.git
cd enhanced-slack
yarn
yarn run inject
```

Running `inject` will:
- Backup the original app.asar
- Extract the app.asar archive
- Add [some js](https://github.com/albinekb/enhanced-slack/blob/master/inject.js) to it
- Re-pack the app.asar

Restart Slack, you should now see syntax highlighting 💅

### Remove
```sh
yarn run eject
```
Running `eject` will:
- Restore the original app.asar
- Cleanup build files
