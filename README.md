## PlatformComparisonScript

The plugin takes Mulesoft Platform snapshot
(see [PlatformSnapshot](https://github.com/KonstantinSviridov/PlatformSnapshot))
as input and compares JSON outputs produced by two versions of
[RAML parser](https://github.com/raml-org/raml-js-parser-2) against
each other.

Moreover, for RAML 0.8 specifications contained in the snapshot
the plugin checks whether the two parser versions fail and succeed in
the same cases as the [old JS RAML parser](https://github.com/raml-org/raml-js-parser).

### Local usage

#### Install development environment installer
Execute
```
npm install dev-env-installer@0.0.10 -g
```

#### Preparing two versions of the parser

Clone [the parser repository](https://github.com/raml-org/raml-js-parser-2) into separate
folders and checkout necessary branches or commits. Inside both folders execute
```
dev-env-installer install --workspace "../" --descriptor "./workspace.json" -directlinks
npm run buildall
```

#### Installing the plugin itself
Clone the repository and install all the dependencies (apart from two versions of the parser):
```
git clone https://github.com/KonstantinSviridov/PlatformComparisonScript
cd PlatformComparisonScript
npm install
npm run devInstall
```
Then you should link the two parser versions to the `node_modules` folder.
One of these versions is refered to as "master" another -- as "inspected".
 
For windows run
```
mklink /J "./node_modules/raml-1-parser" "<absolute or relative path to inspected version>"
mklink /J "./node_modules/raml-1-parser-master" "<absolute or relative path to master version>"
```
For Linux or Mac OS X run
```
ln -s "<absolute or relative path to inspected version>" "./node_modules/raml-1-parser" 
ln -s "<absolute or relative path to master version>" "./node_modules/raml-1-parser-master" 
```
Finally, build the plugin by executing
```
npm run buildall
```
And start comparing the parser versions by
```
npm run compare
```
The JSON output produced by the "master" parser version is collected in the
`/cache` directory, as well as results of the old parser execution.

The report object is placed into the `./reports` folder into the JSON file named after
commit IDs of "master" and "inspected" versions.

### Usage on Travis

#### Repository configuration:

![Travis parameters](./docs/images/travis-parameters.png)

* **GITHUB_EMAIL** **(required)** the email associated with your GitHub account 
 
* **GITHUB_USERNAME** **(required)** arbitrary username uder which the commits are made.
It is visible, for example, in `git log` command output, while GitHub
shows your original name instead of it.

* **TRAVIS_KEY_PRIVATE** **(required)** private part of your SSH key.
See [here](#registerin-ssh-key) for details.
 
* **TRAVIS_KEY_PUBLIC** **(required)** public part of your SSH key.
See [here](#registerin-ssh-key) for details.

* **TIME_LIMIT_MINUTES** restrict time of APIs downloading. As the travis build
is not allowed to last for more
then 50 minutes, download time should be restricted. The default limit is 20 minutes.
It can safely be increased to 25 minutes.

#### Registering SSH key

Suppose, you have two files, `testKey` with the following content:
```
-----BEGIN RSA PRIVATE KEY-----
MIICXAIBAAKBgQDDYILNCqAWj1H/WFqlX58YMdVk2IqMBdkHcyTVu9Aenr8NZmgj
...
...

V1G7C4R7q9NPszaAMmfl4oKVL2pRfG3pVtSOIf1rBb0=
-----END RSA PRIVATE KEY-----
```

and `testKey.pub` with the following content:
```
ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAAAg.......Q4ogQ== RSA-1024

```

First, you should take the `testKey` file content, remove all new line symbols from it,
take its part between the leading and trailing comments
```
MIICXAIBAAKBgQDDY.......................KVL2pRfG3pVtSOIf1rBb0=
```
and set it as **TRAVIS_KEY_PRIVATE** parameter value. We suggest preventing
this value from being visible in Travis build log.

Then you should take the `testKey.pub` file content, take its purt
bounded by `ssh-rsa ` in the beginning and ` RSA-1024` in the end
```
AAAAB3NzaC1yc2EAAAADAQABAAAAg.......Q4ogQ==
```
and set it as **TRAVIS_KEY_PUBLIC** parameter value. We suggest preventing
this value from being visible in Travis build log.

The public key (whole `testKey.pub` file content) should be registered in your
GitHub account.

#### Starting Parser Versions Comparison

In order to comparison process, you should
push a commit with message containing one of the two following strings:
```
TARGET_COMMIT=<id of your commit>
```
or
```
TARGET_BRANCH=<id of your branch>
```
In both cases the strings should be followed by new line or EOF.

The JSON output produced by the "master" parser version is collected in the
`/cache` directory, as well as results of the old parser execution.

The report object is placed into the `./reports` folder into the JSON file named after
commit IDs of "master" and "inspected" versions.

Note that Travis job time limits may disallow comparing the
parsers against the whole snapshot at a time. The plugin is capable
of splitting the job and uses special commit messages for this purpose.
