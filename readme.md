## 🌴 Slack enhanced

This is a proof of concept, to test the idea of injecting code into Slack.app.

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
