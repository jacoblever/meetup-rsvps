#!/usr/bin/env node

const axios = require('axios')

function getEvents(axios, name) {
  return axios({
    method: 'get',
    url: `https://api.meetup.com/Silicon-Throwabout/events/`,
    headers: { 'Accept': 'application/json' },
  }).then(res => {
    return res.data.filter(e => {
      return e.name === name;
    });
  }).catch(err => {
    console.log(err);
  })
}

function getAttendees(axios, eventId) {
  return axios({
    method: 'get',
    url: `https://api.meetup.com/Silicon-Throwabout/events/${eventId}/rsvps`,
    headers: { 'Accept': 'application/json' },
  }).then(res => {
    return res.data.filter(element => {
      return element.response === "yes";
    }).map(element => {
      return element.member.name;
    });
  }).catch(err => {
    console.log(err);
  })
}

output = {};

getEvents(axios, "Tuesday Indoors (Ultimate Frisbee)").then(events => {
  events.forEach(event => {
    output[event.local_date] = {
      count: 0,
      // attendeees: [],
    };
    getAttendees(axios, event.id).then(attendees => {
      attendees.forEach(attendee => {
        output[event.local_date].count++;
        // output[event.local_date].attendeees.push(attendee);
      });
    });
  });
});

setTimeout(() => console.log(output), 10000);


