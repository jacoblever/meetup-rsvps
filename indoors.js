#!/usr/bin/env node

const axios = require('axios')

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

output = {};

getEvents(axios, meetupUrlName, eventName).then(events => {
  return Promise.all(events.map(event => {
    output[event.id] = {
      eventData: event,
      attendeeNames: [],
    };
    attendeePromise = getAttendees(axios, meetupUrlName, event.id);
    attendeePromise.then(attendees => {
      attendees.forEach(attendee => {
        output[event.id].attendeeNames.push(attendee);
      });
    });
    return attendeePromise;
  }));
}).then(() => {
  Object.keys(output).forEach(function (key) {
    info = output[key];
    console.log(`${info.eventData.local_date}: ${info.attendeeNames.length} (${info.attendeeNames.join(",")})`)
  });
});
