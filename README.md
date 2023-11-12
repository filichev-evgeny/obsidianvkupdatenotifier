# Obsidian Vk group posts checker

This  plugin gives you ability to check new posts on the vk.com website

## How to use

- **vk.com account is required**. you can log in in the settings tab of the plugin. The requested permissions are : groups, offline. The authorization is handled by vk.com, plugin have no access to user's login/pass.
- create codeblock with "name:" argument

```vk-group-notifier
  name:nameOfTheGroup
```

```vk-group-notifier
id: 12345
```

* you can overwrite any specific parameters for each code section

```vk-group-notifier
 name:groupName
 maxDays:23
 pinLast:true
 maxTextLength:15
 dateFormat:DD-MMMM-YYYY
```

## Manually installing the plugin

- Copy over `main.js`,  `manifest.json` to your vault `VaultFolder/.obsidian/plugins/anyFolderName/`.

## Android issues

I couldn't figure out how to use webview, so it is required to manually copy-paste auth link into the input field. Yes, I know that look not that user-friendly. You can also login on the PC, any kind of synchronization should carry the auth token.
