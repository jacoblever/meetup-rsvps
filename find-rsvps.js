#!/usr/bin/env node

const axios = require('axios')
const dateFormat = require('dateformat');

const meetupUrlName = "Silicon-Throwabout";
const eventName = "Tuesday Indoors (Ultimate Frisbee)";
const eventsAfter = "2020-01-01";

function getEvents(axios, meetupUrlName, eventName) {
  return axios({
    method: 'get',
    url: `https://api.meetup.com/${meetupUrlName}/events/`,
    headers: { 'Accept': 'application/json' },
  }).then(response => {
    return response.data.filter(e => {
      return e.name === eventName && dateFormat(e.local_date, "yyyy-mm-dd") > eventsAfter;
    });
  }).catch(err => {
    console.log(err);
  })
}

function getAttendees(axios, meetupUrlName, eventId) {
  return axios({
    method: 'get',
    url: `https://api.meetup.com/${meetupUrlName}/events/${eventId}/rsvps`,
    headers: { 'Accept': 'application/json' },
  }).then(response => {
    return response.data
      .filter(element => element.response === "yes")
      .map(element => element.member.name);
  }).catch(err => {
    console.log(err);
  })
}

let infoByEvent = {};
let sessionsByPerson = {};

getEvents(axios, meetupUrlName, eventName).then(events => {
  return Promise.all(events.map(event => {
    infoByEvent[event.id] = {
      eventData: event,
      attendeeNames: [],
    };

    let attendeePromise = getAttendees(axios, meetupUrlName, event.id);
    attendeePromise.then(attendees => {
      attendees.forEach(attendee => {
        infoByEvent[event.id].attendeeNames.push(attendee);
        if (!sessionsByPerson.hasOwnProperty(attendee)) {
          sessionsByPerson[attendee] = [];
        }
        sessionsByPerson[attendee].push(event.local_date);
      });
    });
    return attendeePromise;
  }));
}).then(() => {
  console.log(`Session info by event`);
  Object.keys(infoByEvent).forEach(function (key) {
    let info = infoByEvent[key];
    let date = info.eventData.local_date;
    let attendeeCount = info.attendeeNames.length;
    let attendees = info.attendeeNames.join(", ");
    console.log(`${dateFormat(date, "d mmm")}: ${18 - attendeeCount} spaces left - (${attendees})`);
  });

  console.log(`\nSession count by person`);
  let attendees = Object.keys(sessionsByPerson);
  attendees.sort(function (a, b) {
    return sessionsByPerson[b].length - sessionsByPerson[a].length;
  });
  attendees.forEach(function (attendee) {
    let sessions = sessionsByPerson[attendee];
    console.log(`${attendee}: ${sessions.length}`);
  });

  let people = Object.keys(sessionsByPerson).sort();
  
  let matrixRows = [];

  let linkRow = ["https://tinyurl.com/SiThrowabout"];
  let dateRow = [""];
  let costRow = [""];
  Object.keys(infoByEvent).forEach(key => {
    let date = infoByEvent[key].eventData.local_date;
    linkRow.push(infoByEvent[key].eventData.link);
    dateRow.push(dateFormat(date, "d mmm"));
    costRow.push(5);
  });
  matrixRows.push(linkRow);
  matrixRows.push(dateRow);
  matrixRows.push(costRow);

  people.forEach(person => {
    let row = [person];
    Object.keys(infoByEvent).forEach(key => {
      let value = infoByEvent[key].attendeeNames.some(x => x == person) ? 'y' : 'n';
      row.push(value);
    });
    matrixRows.push(row);
  });

  console.log(`\nTable for google sheet`);
  matrixRows.forEach(row => {
    console.log(row.join(","))
  });
});
