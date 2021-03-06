const core = require('@actions/core');
const { GitHub, context } = require('@actions/github');
const fs = require('fs');

async function run() {
  try {
    // Get authenticated GitHub client (Ocktokit): https://github.com/actions/toolkit/tree/master/packages/github#usage
    const github = new GitHub(process.env.GITHUB_TOKEN);

    // Get owner and repo from context of payload that triggered the action
    const { owner, repo } = context.repo;

    // Get the inputs from the workflow file: https://github.com/actions/toolkit/tree/master/packages/core#inputsoutputs
    const tagName = core.getInput('tag_name', { required: true });

    // This removes the 'refs/tags' portion of the string, i.e. from 'refs/tags/v1.10.15' to 'v1.10.15'
    let tag = tagName.replace('refs/tags/', '');
    let releaseName = core.getInput('release_name', { required: true }).replace('refs/tags/', '');
    const csproj = core.getInput('csproj_path', {required: true });
    const body = core.getInput('body', { required: false });
    const draft = core.getInput('draft', { required: false }) === 'true';
    const prerelease = core.getInput('prerelease', { required: false }) === 'true';

    if(csproj != null){
      const contentsBuffer = fs.readFileSync(csproj);
      const content = contentsBuffer.toString('utf-8');

      let parser = require('fast-xml-parser');
      let he = require('he');

      let options = {
        attributeNamePrefix: '@_',
        attrNodeName: 'attr', //default is 'false'
        textNodeName: '#text',
        ignoreAttributes: true,
        ignoreNameSpace: false,
        allowBooleanAttributes: false,
        parseNodeValue: true,
        parseAttributeValue: false,
        trimValues: true,
        cdataTagName: '__cdata', //default is 'false'
        cdataPositionChar: '\\c',
        parseTrueNumberOnly: false,
        arrayMode: false, //"strict"
        attrValueProcessor: (val, _) => he.decode(val, { isAttributeValue: true }),//default is a=>a
        tagValueProcessor : (val, _) => he.decode(val), //default is a=>a
        stopNodes: ['parse-me-as-string']
      };
      
      // Intermediate obj
      var tObj = parser.getTraversalObj(content,options);
      var jsonObj = parser.convertToJson(tObj,options);
      console.log("release before " + releaseName);
      releaseName = jsonObj.Project.PropertyGroup[0].AssemblyVersion;
      console.log('set releaseName to ' + releaseName);
      tag = "v" + jsonObj.Project.PropertyGroup[0].AssemblyVersion;
    }


    // Create a release
    // API Documentation: https://developer.github.com/v3/repos/releases/#create-a-release
    // Octokit Documentation: https://octokit.github.io/rest.js/#octokit-routes-repos-create-release
    const createReleaseResponse = await github.repos.createRelease({
      owner,
      repo,
      tag_name: tag,
      name: releaseName,
      body,
      draft,
      prerelease
    });

    // Get the ID, html_url, and upload URL for the created Release from the response
    const {
      data: { id: releaseId, html_url: htmlUrl, upload_url: uploadUrl }
    } = createReleaseResponse;

    // Set the output variables for use by other actions: https://github.com/actions/toolkit/tree/master/packages/core#inputsoutputs
    core.setOutput('id', releaseId);
    core.setOutput('html_url', htmlUrl);
    core.setOutput('upload_url', uploadUrl);
  } catch (error) {
    core.setFailed(error.message);
  }
}

module.exports = run;
