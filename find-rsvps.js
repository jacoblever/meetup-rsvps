#!/usr/bin/env node

const axios = require('axios')
const dateFormat = require('dateformat');

const meetupUrlName = "Silicon-Throwabout";
const eventName = "Indoor Ultimate Frisbee in *Hackney Community College* on Thursday evenings";
const eventsDateRange = {from: "2021-09-01T00:00:00.000", to: "2022-01-01T00:00:00.000"};

function getEvents(axios, meetupUrlName, eventName) {
  return axios({
    method: 'get',
    url: `https://api.meetup.com/${meetupUrlName}/events?no_earlier_than=${eventsDateRange.from}&no_later_than=${eventsDateRange.to}&status=past,upcoming`,
    headers: { 'Accept': 'application/json' },
  }).then(response => {
    return response.data.filter(e => {
      return e.name === eventName;
    });
  }).catch(err => {
    console.log(err);
  });
}

function printLine() {
  console.log(`\n------------------------------------------------------------------------------`);
}

function updateEventAttendees(eventInfo) {
  if (process.argv[3] && eventDataFormatted(eventInfo) == process.argv[3]) {
    return true;
  }
  return eventInfo.eventData.status === "upcoming";
}

function eventDataFormatted(eventInfo) {
  let date = eventInfo.eventData.local_date;
  return dateFormat(date, "d mmm");
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
  printLine();
  console.log(`Session info by event`);
  Object.keys(infoByEvent).forEach(function (key) {
    let info = infoByEvent[key];
    let attendeeCount = info.attendeeNames.length;
    let attendees = info.attendeeNames.join(", ");
    console.log(`${eventDataFormatted(info)}: ${18 - attendeeCount} spaces left - (${attendees})`);
  });

  printLine();
  console.log(`Session links by event`);
  Object.keys(infoByEvent).forEach(function (key) {
    let info = infoByEvent[key];
    console.log(`- ${eventDataFormatted(info)}: ${info.eventData.link}`);
  });

  printLine();
  console.log(`Session count by person`);
  let attendees = Object.keys(sessionsByPerson);
  attendees.sort(function (a, b) {
    return sessionsByPerson[b].length - sessionsByPerson[a].length;
  });
  attendees.forEach(function (attendee) {
    let sessions = sessionsByPerson[attendee];
    console.log(`${attendee}: ${sessions.length} (£${sessions.length * 5})`);
  });

  let people = Object.keys(sessionsByPerson).sort();
  
  let matrixRows = [];

  let linkRow = ["https://tinyurl.com/SiThrowabout"];
  let dateRow = [""];
  Object.keys(infoByEvent).forEach(key => {
    linkRow.push(infoByEvent[key].eventData.link);
    dateRow.push(eventDataFormatted(infoByEvent[key]));
  });
  matrixRows.push(linkRow);
  matrixRows.push(dateRow);

  let existingSheet = null;
  let peopleAlreadyInSheet = [];
  if (process.argv[2]) {
    existingSheet = process.argv[2].split("\n").slice(2).map(row => row.split("\t"));
    peopleAlreadyInSheet = existingSheet.map(row => row[0])
  }

  let peopleInMatrix = [];

  peopleAlreadyInSheet.forEach((person, i) => {
    let existingRow = existingSheet[i].slice(1); // remove name cell
    let row = [person];
    Object.keys(infoByEvent).forEach((key, j) => {
      let eventInfo = infoByEvent[key];
      let attending = infoByEvent[key].attendeeNames.some(x => x == person);
      if (updateEventAttendees(eventInfo)) {
        let wasGoing = existingRow[j] == 'y';
        row.push(attending ? 'y' : (wasGoing ? 'd' : 'n'));
      } else {
        row.push(existingRow[j]);
      }
    });
    matrixRows.push(row);
    peopleInMatrix.push(person);
  });

  people.filter(x => !peopleAlreadyInSheet.includes(x)).forEach(person => {
    let row = [person];
    Object.keys(infoByEvent).forEach(key => {
      let eventInfo = infoByEvent[key];
      let attending = infoByEvent[key].attendeeNames.some(x => x == person);
      if (updateEventAttendees(eventInfo)) {
        row.push(attending ? 'y' : 'n');
      } else {
        row.push(attending ? 'y (dup)' : '');
      }
    });
    matrixRows.push(row);
  });

  printLine();
  console.log(`Table for google sheet`);
  matrixRows.forEach(row => {
    console.log(row.join("\t"))
  });
});
