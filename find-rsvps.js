#!/usr/bin/env node

const axios = require('axios')
const dateFormat = require('dateformat');

const meetupUrlName = "Silicon-Throwabout";
const eventName = "Tuesday Indoors (Ultimate Frisbee)";

function getEvents(axios, meetupUrlName, eventName) {
  return axios({
    method: 'get',
    url: `https://api.meetup.com/${meetupUrlName}/events/`,
    headers: { 'Accept': 'application/json' },
  }).then(response => {
    return response.data.filter(e => {
      return e.name === eventName;
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
});
