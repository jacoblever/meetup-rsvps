#!/usr/bin/env node

import axios from 'axios';
import dateFormat from 'dateformat';

const meetupUrlName = "Silicon-Throwabout";
const eventName = "Indoor Ultimate Frisbee in *Hackney Community College* on Thursday evenings";
const eventsDateRange = {from: "2021-09-01T00:00:00.000", to: "2022-05-01T00:00:00.000"};

function getEvents(meetupUrlName, eventName) {
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

function updateEventAttendees(eventInfo, updatingExistingData: boolean): boolean {
  if (!updatingExistingData) {
    return true;
  }
  if (process.argv[3] && process.argv[3].split(",").map(x => x.trim()).includes(eventDataFormatted(eventInfo))) {
    return true;
  }
  return eventInfo.eventData.status === "upcoming";
}

function eventDataFormatted(eventInfo) {
  let date = eventInfo.eventData.local_date;
  return dateFormat(date, "dd/mm/yy");
}

let namesByMemberId = {};

function getRsvps(meetupUrlName, eventId) {
  return axios({
    method: 'get',
    url: `https://api.meetup.com/${meetupUrlName}/events/${eventId}/rsvps`,
    headers: { 'Accept': 'application/json' },
  }).then(response => {
    return response.data
        .filter(element => element.response === "yes")
        .map(element => {
          namesByMemberId[element.member.id] = element.member.name;
          return {
            name: element.member.name,
            id: element.member.id,
          };
        });
  }).catch(err => {
    console.log(err);
  })
}

let infoByEvent = {};
let sessionsByPerson = {};

getEvents(meetupUrlName, eventName).then(events => {
  return Promise.all(events.map(event => {
    infoByEvent[event.id] = {
      eventData: event,
      attendeeNames: [],
      attendeeIds: [],
      attendees: [],
    };

    let attendeePromise = getRsvps(meetupUrlName, event.id);
    attendeePromise.then(attendees => {
      attendees.forEach(attendee => {
        infoByEvent[event.id].attendeeNames.push(attendee.name);
        infoByEvent[event.id].attendeeIds.push(attendee.id);
        infoByEvent[event.id].attendees.push(attendee);
        if (!sessionsByPerson.hasOwnProperty(attendee.id)) {
          sessionsByPerson[attendee.id] = [];
        }
        sessionsByPerson[attendee.id].push(event.local_date);
      });
    });
    return attendeePromise;
  }));
}).then(() => {
  printLine();
  console.log(`Session info by event`);
  Object.keys(infoByEvent).forEach(function (key) {
    let info = infoByEvent[key];
    let attendeeCount = info.attendeeIds.length;
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
  let attendeeIds = Object.keys(sessionsByPerson).map(x => +x);
  attendeeIds.sort(function (a, b) {
    return sessionsByPerson[b].length - sessionsByPerson[a].length;
  });
  attendeeIds.forEach(function (attendeeId) {
    let sessions = sessionsByPerson[attendeeId];
    console.log(`${namesByMemberId[attendeeId]} (${attendeeId}): ${sessions.length} (£${sessions.length * 5})`);
  });

  let personIds = Object.keys(sessionsByPerson).map(x => +x);
  personIds.sort(function (a, b) {
    return namesByMemberId[a].localeCompare(namesByMemberId[b]);
  });
  
  let matrixRows = [];

  let linkRow = ["https://tinyurl.com/SiThrowabout", ""];
  let dateRow = ["", ""];
  Object.keys(infoByEvent).forEach(key => {
    linkRow.push(infoByEvent[key].eventData.link + "attendees");
    dateRow.push(eventDataFormatted(infoByEvent[key]));
  });
  matrixRows.push(linkRow);
  matrixRows.push(dateRow);

  let existingSheet = null;
  let peopleAlreadyInSheet = [];
  let updatingExistingData = false;
  if (process.argv[2]) {
    existingSheet = process.argv[2].split("\n").slice(2).map(row => row.split("\t"));
    peopleAlreadyInSheet = existingSheet.map(row => ({name: row[0], id: +row[1]}));
    updatingExistingData = true;
  }

  peopleAlreadyInSheet.forEach((person, i) => {
    let existingRow = existingSheet[i].slice(2); // remove name and id cells
    let row = [person.name, person.id];
    Object.keys(infoByEvent).forEach((key, j) => {
      let eventInfo = infoByEvent[key];
      let attending = infoByEvent[key].attendeeIds.some(x => x === person.id);
      if (updateEventAttendees(eventInfo, updatingExistingData)) {
        let wasGoing = existingRow[j] === 'y' || existingRow[j] === 'd';
        row.push(attending ? 'y' : (wasGoing ? 'd' : 'n'));
      } else {
        row.push(existingRow[j]);
      }
    });
    matrixRows.push(row);
  });

  personIds.filter(x => !peopleAlreadyInSheet.map(x => x.id).includes(x)).forEach(personId => {
    let row = [namesByMemberId[personId], personId];
    Object.keys(infoByEvent).forEach(key => {
      let eventInfo = infoByEvent[key];
      let attending = infoByEvent[key].attendeeIds.some(x => x === personId);
      if (updateEventAttendees(eventInfo, updatingExistingData)) {
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
