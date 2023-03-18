const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const cors = require('cors');
const { google } = require('googleapis');
const fs = require("fs");
const credentials = require('./credentials.json');

const client_id = credentials.web.client_id;
const client_secret = credentials.web.client_secret;
const redirect_uris = credentials.web.redirect_uris;
const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

const SCOPE = ['https://www.googleapis.com/auth/drive.metadata.readonly https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/drive.file']
const axios = require('axios');

async function checkTokenValidity(accessToken) {
  try {
    const response = await axios.get(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${accessToken}`);
    const tokenInfo = response.data;
    // Token is valid
    return true;
  } catch (error) {
    // Token is invalid
    return false;
  }
}

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.get('/', (req, res) => res.send(' API Running'));

app.get('/getAuthURL', (req, res) => {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPE,
    });
    console.log(authUrl);
    return res.send(authUrl);
});

app.post('/getToken', (req, res) => {
    if (req.body.code == null) return res.status(400).send('Invalid Request');
    oAuth2Client.getToken(req.body.code, (err, token) => {
        if (err) {
            console.error('Error retrieving access token', err);
            return res.status(400).send('Error retrieving access token');
        }
        res.send(token);
    });
});

app.post('/getUserInfo',async (req, res) => {
    if (req.body.token == null) return res.status(400).send('Token not found');
    oAuth2Client.setCredentials(req.body.token);
    let valid=await checkTokenValidity(req.body.token.access_token);
    if(valid){
    const oauth2 = google.oauth2({ version: 'v2', auth: oAuth2Client });

    oauth2.userinfo.get((err, response) => {
        if (err) res.status(400).send(err);
        console.log(response.data);
        res.send(response.data);
    })
}
else{
    res.status(400).send('Token is invalid')
}
});


app.post('/analytics', async (req, res) => {

    if (req.body.token == null) return res.status(400).send('Token not found');
    oAuth2Client.setCredentials(req.body.token);
    let valid=await checkTokenValidity(req.body.token.access_token);
    if(valid){
    try {
      const drive = google.drive({version: 'v3', auth: oAuth2Client});
  
      const publicFilesResponse = await drive.files.list({
        pageSize: 1000
      });
      const publicFilesCount = publicFilesResponse.data.files.length;
  

      const accessCountResponse = await drive.permissions.list({
        fileId: 'root',
        fields: 'kind, nextPageToken, permissions(role, type)'
      });
      const accessCount = accessCountResponse.data.permissions.filter(permission => permission.type === 'user' && permission.role !== 'owner').length;
  

      const externalFilesResponse = await drive.files.list({
        q: 'visibility = \'limited\'',
        pageSize: 1000
      });
      const externalFilesCount = externalFilesResponse.data.files.length;

      const people = google.people({version: 'v1', auth: oAuth2Client});

      const profileResponse = await people.people.get({
        resourceName: 'people/me',
        personFields: 'names,photos'
      });
      const {names, photos} = profileResponse.data;
  
      const name = names[0].displayName;
      const profilePicUrl = photos[0].url;
  
      res.status(200).json({publicFilesCount,accessCount,externalFilesCount,name,profilePicUrl});
    } catch (err) {
      console.error(err);
      res.status(500).send('Error calculating risk score');
    }}
    else{
        res.status(400).send('Token is invalid')
    }
  });

app.delete('/revoke',async (req,res)=>{
    console.log('---------------------------------',req.body);
    if (req.body.token == null) return res.status(400).send('Token not found');
    oAuth2Client.setCredentials(req.body.token);
    
    let valid=await checkTokenValidity(req.body.token.access_token);
    if(valid){
    oAuth2Client.revokeCredentials((err, result) => {
        if (err) {
            console.error('Error revoking credentials:', err);
            return res.status(400).send(err)
        } else {
            console.log('Credentials revoked successfully:', result);
            return res.send('Revoked')
        }
      });
    }
    else{
        res.status(400).send('Token is not valid');
    }
      // Remove the OAuth2 authorization from the client.
})

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server Started ${PORT}`));